const percussionNote = {
    35: "Acoustic/Low Bass Drum",
    36: "Electric/High Bass Drum",
    37: "Side Stick",
    38: "Acoustic Snare",
    39: "Hand Clap",
    40: "Electric Snare/Rimshot",
    41: "Low Floor Tom",
    42: "Closed Hi-hat",
    43: "High Floor Tom",
    44: "Pedal Hi-hat",
    45: "Low Tom",
    46: "Open Hi-hat",
    47: "Low-Mid Tom",
    48: "High-Mid Tom",
    49: "Crash Cymbal 1",
    50: "High Tom",
    51: "Ride Cymbal 1",
    52: "Chinese Cymbal",
    53: "Ride Bell",
    54: "Tambourine",
    55: "Splash Cymbal",
    56: "Cowbell",
    57: "Crash Cymbal 2",
    58: "Vibraslap",
    59: "Ride Cymbal 2",
    60: "High Bongo",
    61: "Low Bongo",
    62: "Mute High Conga",
    63: "Open High Conga",
    64: "Low Conga",
    65: "High Timbale",
    66: "Low Timbale",
    67: "High Agogô",
    68: "Low Agogô",
    69: "Cabasa",
    70: "Maracas",
    71: "Short Whistle",
    72: "Long Whistle",
    73: "Short Güiro",
    74: "Long Güiro",
    75: "Claves",
    76: "High Woodblock",
    77: "Low Woodblock",
    78: "Mute Cuíca",
    79: "Open Cuíca",
    80: "Mute Triangle",
    81: "Open Triangle",
};

const valueAt = (list = [], ticks, fallback) => {
    let v = fallback;
    for (const cc of list) {
        if (cc.ticks > ticks) break;
        v = cc.value;                 // already normalized 0–1
    }
    return v;
};

function tempoAt(beat, tc) {
    const tempoChanges = tc.toSorted((a, b) => a.beat - b.beat);

    let tempo = 0;
    for (const tempoChange of tempoChanges) {
        if (tempoChange.beat > beat) { break; }
        tempo = tempoChange["dynamicData"]["tempo"];
    }

    return tempo;
}

function combinePan(base, add) {
    const headroom = add >= 0 ? 1 - add : 1 + add;
    return add + base * headroom
}

function parseBoolean(string) {
    const truthyValues = ["true", "yes"];
    return truthyValues.includes(String(string).toLowerCase().trim());
}

function applyDecalOptions(entity, instrument, flip) {
    entity.dynamicData.layer += instrument.decallayer
    entity.dynamicData.sX += instrument.decalx
    entity.dynamicData.eX += instrument.decalx
    entity.dynamicData.sY += instrument.decaly
    entity.dynamicData.eY += instrument.decaly
    entity.dynamicData.sWidth *= instrument.decalwidth / ldm
    entity.dynamicData.eWidth *= instrument.decalwidth / ldm
    entity.dynamicData.sHeight *= instrument.decalheight / ldm
    entity.dynamicData.eHeight *= instrument.decalheight / ldm
    entity.dynamicData.sRot += instrument.decalrot
    entity.dynamicData.eRot += instrument.decalrot

    entity.dynamicData.sWidth *= flip;
    entity.dynamicData.eWidth *= flip;
}

async function multiplyResolution(blob, factor) {
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bmp.width * factor, bmp.height * factor);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return canvas.convertToBlob({ type: "image/jpeg", quality: 1 });
}

/* play sfx
{
    "type":"riq__Entity",
    "version":0,
    "datamodel":"advanced/play sfx",
    "beat":1.0,
    "length":0.5,
    "dynamicData":{
        "track":1.0,
        "game":{
            "value":43,
            "Values":["common","airboarder","airRally","animalAcrobat","balloonHunter","basketballGirls","bigRockFinish","blueBear","blueBirds","boardMeeting","bonOdori","bossaNova","bouncyRoad","builtToScaleDS","builtToScaleRvl","cannery","catchOfTheDay","catchyTune","chameleon","chargingChicken","cheerReaders","clappyTrio","clapTrap","coinToss","cropStomp","djSchool","dogNinja","doubleDate","dressYourBest","drummerDuel","drummingPractice","fanClub","figureFighter","fillbots","fireworks","firstContact","flipperFlop","forkLifter","freezeFrame","frogHop","frogPrincess","fruitBasket","gardenDance","gleeClub","holeInOne","karateman","kitties","launchParty","lockstep","loveLab","loveLizards","loveRap","lumbearjack","magicGirl","mannequinFactory","manzai","marchingOrders","meatGrinder","moaiDooWop","monkeyWatch","mrUpbeat","munchyMonk","nailCarpenter","nightWalkAgb","ninjaBodyguard","nipInTheBud","noGame","octopusMachine","packingPests","pajamaParty","powerCalligraphy","quizShow","rapMen","rhythmFighter","rhythmRally","rhythmSheriff","rhythmSomen","rhythmTestGBA","rhythmTweezers","ringside","rockers","agbSamuraiSlice","samuraiSliceNtr","samuraiSliceRvl","seeSaw","shootEmUp","showtime","sickBeats","slotMonster","sneakySpirits","spaceball","spaceDance","spaceSoccer","splashdown","sumoBrothers","superSamuraiSlice","tambourine","tapTrial","tapTroupe","theDazzles","tossBoys","totemClimb","tramAndPauline","trickClass","tunnel","valiantVolley","fallingWaffle","warioDeMambo","wizardsWaltz","workingDough"]
        },
        "getSfx":"Glee Club",
        "sfxName":{
            "value":9,
            "Values":["BatonDown","BatonUp","LoudWailLoop","LoudWailStart","StopWail","togetherEN-01","togetherEN-02","togetherEN-03","togetherEN-04","WailLoop"]
        },
        "useSemitones":false,
        "semitones":0,
        "cents":0,
        "pitch":1.0,
        "volume":1.0,
        "panning":0.0,
        "offset":0,
        "loop":true
    }
}
*/

/* tempo change
{
    "type":"riq__TempoChange",
    "version":0,
    "datamodel":"global/tempo change",
    "beat":0.0,
    "length":0.0,
    "dynamicData":{
        "tempo":120.0,
        "swing":0.0,
        "timeSignature":{"x":4.0,"y":4.0},
        "swingDivision":1.0
    }
}
*/

/* custom sfx
{
    "type":"riq__Entity",
    "version":0,
    "datamodel":"advanced/play custom sfx",
    "beat":4.0,
    "length":1.0,
    "dynamicData":{
        "track":1,
        "sfxName":"slow4",
        "useSemitones":false,
        "semitones":0,
        "cents":0,
        "pitch":1.0154,
        "volume":1.0,
        "panning":0.0,
        "offset":0,
        "loop":true
    }
},
*/

/* decal
{
    "type":"riq__Entity",
    "version":1,
    "datamodel":"vfx/display decal",
    "beat":1,
    "length":0.1,
    "dynamicData":{
        "track":1,
        "sprite":"name",
        "filter":1,
        "ease":1,
        "layer":0,
        "displayLayer":1,
        "sticky":false,
        "sX":0,
        "sY":0,
        "sZ":0,
        "sWidth":1,
        "sHeight":1,
        "sRot":0,
        "sColor":{
            "r":1,
            "g":1,
            "b":1,
            "a":1
        },
        "eX":0,
        "eY":0,
        "eZ":0,
        "eWidth":1,
        "eHeight":1,
        "eRot":0,
        "eColor":{
            "r":1,
            "g":1,
            "b":1,
            "a":1
        }
    }
},
*/