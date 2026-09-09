const midi_input = document.getElementById("midi_input");
const remix_download = document.getElementById("remix_download");
const sfx_section = document.getElementById("sfx_section");
const riq_settings_input = document.getElementById("riq_settings_input");
const sfx_riq_input = document.getElementById("sfx_riq_input");
const sfx_riq_default_toggle = document.getElementById("sfx_riq_default_toggle");
const selector_template = document.getElementById("selector_template");
const hs_preview = document.getElementById("hs_preview");
const decal_editor = document.getElementById("decal_editor");
const decal_option_template = document.getElementById("decal_option_template");

const sfx_selectors = [];
const websiteTitle = document.title;

let selectedDiv;
let ldm = 1;
let noDecal = true;


midi_input.addEventListener("input", async (e) => {
    await loadSfxData();
    await getNoteData(e.target.files[0]);

    loadSfxSelectors();
});

riq_settings_input.addEventListener("input", async (e) => {
    const riq = await JSZip.loadAsync(e.target.files[0]);
    await loadResources(riq);

    const instrumentDataFile = riq.file(`${websiteTitle}/instrument_data.json`);
    const sfxDataFile = riq.file(`${websiteTitle}/sfx_data.json`);
    const midiFile = riq.file(`${websiteTitle}/song.mid`)

    if (!(instrumentDataFile && sfxDataFile && midiFile)) {
        alert(`${websiteTitle} data not found`)
    }

    const instrumentDataJsonString = await instrumentDataFile.async("string");
    const sfxDataJsonString = await sfxDataFile.async("string");

    const instrumentData = JSON.parse(instrumentDataJsonString);
    sfxData = JSON.parse(sfxDataJsonString);

    const midiFileObject = new File([await midiFile.async("blob")], "song.mid", { type: "audio/midi" });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(midiFileObject);
    midi_input.files = dataTransfer.files;

    instruments = Object.keys(instrumentData);
    loadSfxSelectors();

    for (const div of sfx_section.children) {
        const instrumentName = div.querySelector(".name").dataset.instrument

        div.querySelector(".select").value = instrumentData[instrumentName]["sfx"];
        div.querySelector(".volume").value = instrumentData[instrumentName]["volume"] ?? 1;

        const decalData = {};
        for (const [key, value] of Object.entries(instrumentData[instrumentName])) {
            if (key.substring(0, 5) == "decal") {
                decalData[key.substring(5)] = value;
            }
        }
        Object.assign(div.querySelector(".decal_select").dataset, decalData);
    }
    await updateCanvas();

    sfx_riq_default_toggle.checked = false;

    await getNoteData(midi_input.files[0]);
});

sfx_riq_input.addEventListener("input", async (e) => {
    sfxRiqFile = e.target.files[0];
    sfx_riq_default_toggle.checked = false;

    await loadSfxData();
    loadSfxSelectors();
});

sfx_riq_default_toggle.addEventListener("change", async (e) => {
    const inputFile = sfx_riq_input.files[0];

    if (!e.target.checked && inputFile) {
        sfxRiqFile = inputFile
    } else {
        sfxRiqFile = defaultSfxRiqFile;
    }

    await loadSfxData();
    loadSfxSelectors();
});

/*
function updateSfxSelection(sfx) {
    for (const s of sfx) {
        const option = document.createElement("option");
        option.value = s["name"];
        option.textContent = s["name"];

        sfx_selection.appendChild(option);
        console.log(s["name"]);
    }
}
    */

async function generateButton() {
    URL.revokeObjectURL(remix_download.href);
    remix_download.removeAttribute("href");

    const riqBlob = await convertToRemix(midi_input.files[0]);

    outputURL = URL.createObjectURL(riqBlob);

    remix_download.href = outputURL;
    remix_download.download = "remix.riq";
}

function getInstrumentData() {
    const output = {};
    let index = 0;

    for (const div of sfx_section.children) {
        const instrument = div.querySelector(".name").dataset.instrument;
        const sfxName = div.querySelector(".select").value;
        const volume = parseFloat(div.querySelector(".volume").value);

        output[instrument] = {
            "sfx": sfxName,
            "index": index,
            "volume": volume,
        };

        for (const [key, value] of Object.entries(div.querySelector(".decal_select").dataset)) {
            output[instrument][`decal${key}`] = parseFloat(value);
        }
        index++;
    }

    console.log(output);
    return output;
}

function loadSfxSelectors() {
    sfx_section.replaceChildren();
    sfx_selectors.length = 0;

    const optionTemplate = document.createDocumentFragment();
    for (const s of sfxData) {
        const option = document.createElement("option");
        option.value = s["name"];
        option.textContent = s["name"];

        optionTemplate.appendChild(option);
    }

    const frag = document.createDocumentFragment();

    instruments.forEach((instrument, index) => {
        const template = selector_template.content.cloneNode(true);

        const name = template.querySelector(".name");
        Object.assign(name.dataset, {
            "instrument": instrument,
        });
        name.textContent = `${index + 1}. ${instrument}`;

        Object.assign(template.querySelector(".decal_select").dataset, {
            "layer": 0,
            "x": 0,
            "y": 0,
            "z": 0,
            "width": 1,
            "height": 1,
            "rot": 0,

        });

        template.querySelector(".select").appendChild(optionTemplate.cloneNode(true));

        frag.appendChild(template);
        sfx_selectors.push(template);
    });

    sfx_section.appendChild(frag);
}

const ctx = hs_preview.getContext("2d");

function selectInstrument(button) {
    const div = button.parentElement;
    selectedDiv = div;
    const sfxName = div.querySelector(".select").value;
    const sfx = sfxData.find(s => s.name == sfxName);
    if (sfx.decalEntities.length == 0) { return; }

    decal_editor.querySelector(".instrument_name").textContent = div.querySelector(".name").dataset.instrument;

    const decal_options = decal_editor.querySelector(".decal_options");
    decal_options.replaceChildren();
    const frag = document.createDocumentFragment();
    for (const [key, value] of Object.entries(button.dataset)) {
        const template = decal_option_template.content.cloneNode(true);

        const span = template.querySelector("span");
        span.textContent = `${key} `;

        const input = template.querySelector("input");
        input.value = value;
        input.name = key;
        input.addEventListener("change", updateSelectedDiv);

        frag.appendChild(template);
    }
    decal_options.appendChild(frag);
}

function updateSelectedDiv() {
    const decalData = {};

    for (const input of decal_editor.querySelectorAll("input")) {
        decalData[input.name] = input.value;
    }

    Object.assign(selectedDiv.querySelector(".decal_select").dataset, decalData);
    updateCanvas();

}

async function updateCanvas() {
    console.log("canvas updated");
    const decals = [];
    const instrumentData = getInstrumentData();
    ctx.drawImage(document.getElementById("canvas_background"), 0, 0);

    for (const [_, instrument] of Object.entries(instrumentData)) {
        const sfx = sfxData.find(s => s.name == instrument["sfx"]);
        if (sfx.decalEntities.length == 0) { continue; }
        const entity = sfx.decalEntities[0];

        decals.push({
            "layer": entity.dynamicData.layer + instrument.decallayer,
            "x": entity.dynamicData.eX + instrument.decalx,
            "y": entity.dynamicData.eY + instrument.decaly,
            "width": entity.dynamicData.eWidth * instrument.decalwidth,
            "height": entity.dynamicData.eHeight * instrument.decalheight,
            "rot": entity.dynamicData.eRot + instrument.decalrot,
            "blob": resources.find(r => r["name"].substring("Resources/Sprites/".length, "Resources/Sprites/".length + entity.dynamicData.sprite.length) == entity.dynamicData.sprite)["blob"],
        });
    }

    decals.sort((a, b) => a.layer - b.layer);
    console.log(decals);

    for (const decal of decals) {
        const bmp = await createImageBitmap(decal.blob);

        const x = 889 + decal.x * 100;
        const y = 500 + decal.y * -100;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(decal.rot * Math.PI / 180);
        ctx.scale(decal.width / ldm, decal.height / ldm)
        ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
        ctx.restore();
    }
}
updateCanvas();