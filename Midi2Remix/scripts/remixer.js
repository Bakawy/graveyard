let sfxData = [];
let instruments = [];
const noteData = [];
let sfxRiqFile;
let defaultSfxRiqFile;
fetch("sfx.riq").then((value) => {
    defaultSfxRiqFile = value;
    sfxRiqFile = defaultSfxRiqFile;
});
let resources = [];


async function convertToRemix(file) {
    const midi = await loadMidi(file);
    const { riq, remix } = await loadRiq(await (await fetch("remix.riq")).arrayBuffer());
    console.log(midi, riq, remix);

    const tempoTemplate = remix["tempoChanges"][0];
    remix["entities"] = [];
    remix["tempoChanges"] = [];

    const ppq = midi.header.ppq;
    midi.header.tempos.forEach(tempo => {
        const tempoChange = structuredClone(tempoTemplate);

        tempoChange["beat"] = tempo.ticks / ppq;
        tempoChange["dynamicData"]["tempo"] = tempo.bpm;

        remix["tempoChanges"].push(tempoChange);
    });

    let instrumentData;
    [remix["entities"], instrumentData] = chartEntities(remix["entities"], remix["tempoChanges"]);

    console.log(remix)
    return await packRIQ(riq, remix, instrumentData, file);
}

async function loadMidi(file) {
    const fileUrl = URL.createObjectURL(file);
    const midi = await Midi.fromUrl(fileUrl);

    return midi;
}

async function loadRiq(buffer) {
    const riq = await JSZip.loadAsync(buffer);

    const jsonStringBOM = await riq.files["remix.json"].async("string");
    const jsonString = jsonStringBOM.replace(/^\uFEFF/, '');
    const remix = JSON.parse(jsonString);

    return { riq, remix };
}

async function loadSfxData() {
    const { riq, remix } = await loadRiq(await sfxRiqFile.arrayBuffer());
    //get sound resources
    loadResources(riq);

    //get entity data
    sfxData.length = 0;
    for (const entity of remix["entities"]) {
        if (entity["datamodel"] == "gameManager/editor note") {
            const [sfxName, pitch, isStaccato] = entity["dynamicData"]["note"].split("|");
            //console.log(name, pitch);

            sfxData.push({
                "name": sfxName,
                "pitch": parseInt(pitch, 10),
                "isStaccato": parseBoolean(isStaccato),
                "startBeat": entity["beat"],
            });
        }
    }

    sfxData.sort((a, b) => a.startBeat - b.startBeat);

    sfxData.forEach((s, i) => {
        const entities = [];
        const decalEntities = [];
        let lastBeat = s.startBeat;
        for (const entity of remix["entities"]) {
            if (entity["datamodel"] != "gameManager/editor note") {
                if (entity["beat"] >= s.startBeat && (i == sfxData.length - 1 || entity["beat"] < sfxData[i + 1]["startBeat"])) {
                    if (entity.datamodel == "vfx/display decal") {
                        decalEntities.push(entity);
                    } else {
                        entities.push(entity);
                    }

                    if (entity["beat"] + entity["length"] > lastBeat) {
                        lastBeat = entity["beat"] + entity["length"];
                    }
                }
            }
        }
        s["entities"] = entities;
        s["decalEntities"] = decalEntities;
        s["length"] = lastBeat - s.startBeat;
    });

    console.log(sfxData);
    //updateSfxSelection(sfxData);
}

async function loadResources(riq) {
    resources.length = 0;
    /*
    const soundFolder = riq.folder("Resources/Sounds");
    if (soundFolder) {
        soundFolder.forEach(async function (_, file) {
            if (!file.dir) {
                resources.push({
                    "blob": await file.async("blob"),
                    "name": file.name,
                    "type": "sound",
                });
            }
        });
    }
    const spriteFolder = riq.folder("Resources/Sprites");
    if (spriteFolder) {
        spriteFolder.forEach(async function (_, file) {
            if (!file.dir) {
                resources.push({
                    "blob": await file.async("blob"),
                    "name": file.name,
                    "type": "sprite",
                });
            }
        });
    }
    */

    for (const [filename, file] of Object.entries(riq.files)) {
        if (file.dir || !filename.startsWith("Resources/")) { continue; }

        let blob = await file.async("blob");

        if (ldm != 1 && filename.substring("Resources/".length, "Resources/".length + "Sprites".length) == "Sprites") {
            blob = await multiplyResolution(blob, ldm);
        }

        resources.push({
            "blob": blob,
            "name": filename,
        });
    }

    console.log(resources);
}

async function getNoteData(file) {
    const midi = await loadMidi(file);
    const ppq = midi.header.ppq;

    noteData.length = 0;
    instruments.length = 0;
    for (const track of midi.tracks) {
        const instrumentName = track.instrument.name;
        if (!instrumentName) { continue; }
        if (track.notes.length == 0) { continue; }

        if (!(instruments.includes(instrumentName) || track.instrument.percussion)) {
            instruments.push(instrumentName);
        }

        for (const note of track.notes) {
            let iName = instrumentName;

            if (track.instrument.percussion) {
                iName += ", " + percussionNote[note.midi] ?? `Instrument #${note.midi}`;

                if (!instruments.includes(iName)) {
                    instruments.push(iName);
                }

                note.durationTicks *= -1;
                note.midi *= -1;
            }

            const noteDatum = {
                "pitch": note.midi,
                //"volume": Math.pow(note.vevalueAt(track.controlChanges[7], note.ticks, 1) * valueAt(track.controlChanges[11], note.ticks, 1), 2),
                "volume": note.velocity * Math.pow(valueAt(track.controlChanges[7], note.ticks, 1), 2) * Math.pow(valueAt(track.controlChanges[11], note.ticks, 1), 2),
                "beat": note.ticks / ppq,
                "length": note.durationTicks / ppq,
                "trackName": track.name,
                "instrumentName": iName,
                "panning": valueAt(track.controlChanges[10], note.ticks, 0.5) * 2 - 1,
            };

            noteData.push(noteDatum);
        }
    }
}

function chartEntities(entities, tempoChanges) {
    const instrumentData = getInstrumentData();
    const decalEvents = getDecalEvents();


    for (const note of noteData) {
        const sfx = sfxData.find(sfx => sfx.name == instrumentData[note.instrumentName]["sfx"]);

        for (const e of sfx["entities"]) {
            const entity = structuredClone(e);
            const tempo = tempoAt(note.beat, tempoChanges);

            const relativeBeat = entity.beat - sfx.startBeat;
            entity.beat = relativeBeat / sfx.length * note.length + note.beat;
            if (note.length >= 0) {
                entity.length = entity.length / sfx.length * note.length;
            } else {
                entity.length *= tempo / 120;
            }
            entity.dynamicData.track = instrumentData[note.instrumentName]["index"];

            if (["advanced/play sfx", "advanced/play custom sfx"].includes(entity.datamodel)) {
                const deltaPitch = note.pitch >= 0 ? Math.pow(2, (note.pitch - sfx.pitch) / 12) : 1;

                entity.dynamicData.pitch *= deltaPitch;
                entity.dynamicData.volume *= note.volume * instrumentData[note.instrumentName]["volume"];
                entity.dynamicData.offset /= deltaPitch;
                entity.dynamicData.panning = combinePan(entity.dynamicData.panning, note.panning);

                if (sfx.isStaccato) {
                    entity.length = e.length / deltaPitch * tempo / 120
                }
            }

            entities.push(entity);
        }
    }

    for (const [index, events] of decalEvents.entries()) {
        const instrument = Object.values(instrumentData).find(i => i.index == index);
        console.log(instrument);
        const sfx = sfxData.find(sfx => sfx.name == instrument["sfx"]);
        if (sfx.decalEntities.length == 0 || noDecal) { continue; }

        let flip = -1;
        for (const event of events) {
            if (event.type == "play") {
                flip *= -1;

                dpb = sfx.decalEntities.length / event.length; // decals per beat
                bpm = tempoAt(event.beat, tempoChanges);
                dps = dpb * bpm / 60; //decals per second

                stretch = Math.max(Math.floor(dps / 15), 1);

                for (let i = 0; i < sfx.decalEntities.length; i += 1) {
                    const entity = structuredClone(sfx.decalEntities[i]);
                    if (i % stretch == 0) {

                        const relativeBeat = entity.beat - sfx.startBeat;
                        entity.beat = relativeBeat / sfx.length * event.length + event.beat;
                        entity.length = entity.length / sfx.length * event.length;

                        entity.dynamicData.track = index + 10;

                        applyDecalOptions(entity, instrument, flip);

                        entities.push(entity);
                    } else {
                        entities.at(-1).length += entity.length / sfx.length * event.length;
                    }
                }
            } else if (event.type == "idle") {
                const entity = structuredClone(sfx.decalEntities.at(-1));

                entity.beat = event.beat;
                entity.length = event.length;

                entity.dynamicData.track = index + 10;

                applyDecalOptions(entity, instrument, flip);

                entities.push(entity);
            }
        }
    }

    return [entities, instrumentData];
}

async function packRIQ(riq, remix, instrumentData, midiFile) {
    const endString = JSON.stringify(remix);
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const jsonBytes = new TextEncoder().encode(endString);

    const data = new Uint8Array(bom.length + jsonBytes.length);
    data.set(bom, 0);
    data.set(jsonBytes, bom.length);

    riq.file("remix.json", data, { binary: true });

    const projectFolder = riq.folder(websiteTitle);
    projectFolder.file("instrument_data.json", JSON.stringify(instrumentData, null, 2));
    projectFolder.file("sfx_data.json", JSON.stringify(sfxData, null, 2));
    projectFolder.file("song.mid", midiFile);

    for (const r of resources) {
        riq.file(r.name, r.blob);
    }

    const zipBlob = await riq.generateAsync({
        type: "blob",
        compression: "DEFLATE",
    });
    return zipBlob
}

function getDecalEvents() {
    const decalEvents = [];
    const instrumentData = getInstrumentData();

    const noteEvents = [];
    for (const _ of Object.keys(instrumentData)) {
        noteEvents.push([]);
        decalEvents.push([]);
    }

    const sortedNoteData = noteData.toSorted((a, b) => a.beat - b.beat);
    for (const note of sortedNoteData) {
        noteEvents[instrumentData[note.instrumentName]["index"]].push({
            "type": true,//hold
            "beat": note.beat,
        });

        noteEvents[instrumentData[note.instrumentName]["index"]].push({
            "type": false,//release
            "beat": note.beat + note.length,
        });
    }

    for (const [index, instrument] of noteEvents.entries()) {
        let active = 0; //count of holding notes
        let currentBeat = instrument[0].beat;
        let currentEvent;

        function addEvent(type) {
            if (currentEvent) { currentEvent.length = currentBeat - currentEvent.beat; }
            decalEvents[index].push({
                "type": type,
                "beat": currentBeat,
                "length": 2,
            });
            currentEvent = decalEvents[index].at(-1);
        }
        addEvent("play");

        for (const event of instrument) {
            if (event.type) {
                active++;

                if (event.beat > currentBeat) {
                    currentBeat = event.beat;

                    addEvent("play");
                }
                if (currentEvent.type == "idle" && event.beat == currentBeat) {
                    currentEvent.type = "play";
                }
            } else {
                active--;

                if (event.beat > currentBeat) {
                    currentBeat = event.beat;

                    if (active == 0) {
                        addEvent("idle");
                    }
                }
            }
        }
    }

    return decalEvents;
}