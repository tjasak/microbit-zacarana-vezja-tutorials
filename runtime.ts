// Skriti ucni motor. Vrednosti strojne opreme izvirajo iz .ai/ARCH.yaml.
namespace zacaranaRuntime {
    const RADIO_GROUP = 23
    const TX_RETRIES = 3
    const TX_INTERVAL_MS = 100
    const LIGHT_DELTA = 20
    const TILT_RATIO_PERMILLE = 707
    const LEVEL_RATIO_PERMILLE = 259
    const LEVEL_HOLD_MS = 300
    const SOUND_THRESHOLD = 200
    const SOUND_SAMPLES = 3
    const MAGNET_DELTA = 8
    const MOTION_DELTA = 2
    const MOTION_TARGET_MS = 3000
    // P5 timing is defined in ARCH.yaml / p5_hisa.hint.
    const HINT_REPEAT_PAUSE_MS = 1200

    let station = Postaja.P1
    let active = false
    let solved = false
    let party = false
    let solvedHandler: () => void = null

    let lightBaseline = 0
    let tiltStep = 0
    let levelSince = -1
    let loudSamples = 0
    let codeStep = 0
    let hintAt = 0
    let hintVisible = false
    let hintErrorUntil = 0
    let generation = 0
    let magneticBaselineX = 0
    let magneticBaselineY = 0
    let magneticBaselineZ = 0
    let previousX = 0
    let previousY = 0
    let previousZ = 0
    let motionMs = 0
    let ring0: neopixel.Strip = null
    let ring1: neopixel.Strip = null

    //% blockHidden=true
    export function setSolvedHandler(handler: () => void): void {
        solvedHandler = handler
    }

    function ensureRings(): void {
        if ((station == Postaja.P4 || station == Postaja.P5 || station == Postaja.P6) && ring0 == null) {
            let count = station == Postaja.P6 ? 12 : 8
            ring0 = neopixel.create(DigitalPin.P0, count, NeoPixelMode.RGB)
            ring0.clear()
            ring0.show()
        }
        if (station == Postaja.P4 && ring1 == null) {
            ring1 = neopixel.create(DigitalPin.P1, 8, NeoPixelMode.RGB)
            ring1.clear()
            ring1.show()
        }
    }

    function clearOutputs(): void {
        music.stopAllSounds()
        led.enable(true)
        basic.clearScreen()
        if (station == Postaja.P1 || station == Postaja.P3) pins.digitalWritePin(DigitalPin.P0, 0)
        if (ring0 != null) {
            ring0.clear()
            ring0.show()
        }
        if (ring1 != null) {
            ring1.clear()
            ring1.show()
        }
    }

    function resetState(fromRadio: boolean): void {
        generation += 1
        party = false
        solved = false
        tiltStep = 0
        levelSince = -1
        loudSamples = 0
        codeStep = 0
        hintVisible = false
        hintErrorUntil = 0
        motionMs = 0
        active = !fromRadio || station == Postaja.P1
        lightBaseline = input.lightLevel()
        magneticBaselineX = input.magneticForce(Dimension.X)
        magneticBaselineY = input.magneticForce(Dimension.Y)
        magneticBaselineZ = input.magneticForce(Dimension.Z)
        previousX = magneticBaselineX
        previousY = magneticBaselineY
        previousZ = magneticBaselineZ
        clearOutputs()
        showInstruction()
    }

    function showInstruction(): void {
        if (!active || solved || party) return
        if (station == Postaja.P2) {
            if (tiltStep == 0) basic.showArrow(ArrowNames.West, 0)
            else if (tiltStep == 1) basic.showArrow(ArrowNames.East, 0)
            else basic.showLeds(". . . . .\n. . . . .\n# # # # #\n. . . . .\n. . . . .", 0)
        } else if (station == Postaja.P5) {
            hintVisible = true
            hintAt = input.runningTime()
            updateHouseHint()
        }
    }

    function updateHouseHint(): void {
        if (station != Postaja.P5 || !active || solved || party || !hintVisible) return
        if (input.runningTime() < hintErrorUntil) return
        let elapsed = (input.runningTime() - hintAt) % (3600 + HINT_REPEAT_PAUSE_MS)
        if (elapsed >= 3600 || Math.idiv(elapsed, 600) % 2 == 1) basic.clearScreen()
        else if (Math.idiv(elapsed, 600) == 2) basic.showLeds(". # # # .\n# . . . #\n. . . # .\n. . # . .\n# # # # #", 0)
        else basic.showLeds(". . # . .\n. # # . .\n. . # . .\n. . # . .\n. # # # .", 0)
    }

    function activate(): void {
        if (solved || party) return
        active = true
        showInstruction()
        if (station == Postaja.P4) {
            ring0.setBrightness(220)
            ring0.showColor(neopixel.rgb(255, 48, 0))
        }
        if (station == Postaja.P6) complete()
    }

    function complete(): void {
        if (!active || solved || party) return
        solved = true
        active = false
        let responseGeneration = generation
        if (solvedHandler != null) solvedHandler()
        // Finite native block experiments may finish after RESET/PARTY.
        // Restore the current scene and never retain their stale final screen.
        if (responseGeneration != generation) {
            if (party) {
                basic.showIcon(IconNames.Fabulous, 0)
            } else {
                clearOutputs()
                showInstruction()
            }
        }
    }

    function sendThree(signal: string): void {
        for (let i = 0; i < TX_RETRIES; i++) {
            if (!solved || party) return
            radio.sendString(signal)
            basic.pause(TX_INTERVAL_MS)
        }
    }

    function incomingSignal(): string {
        if (station == Postaja.P2) return "START"
        if (station == Postaja.P3) return "BOO"
        if (station == Postaja.P4) return "STAR"
        if (station == Postaja.P5) return "HOUSE"
        if (station == Postaja.P6) return "MOON"
        return ""
    }

    function nextSignal(): string {
        if (station == Postaja.P1) return "START"
        if (station == Postaja.P2) return "BOO"
        if (station == Postaja.P3) return "STAR"
        if (station == Postaja.P4) return "HOUSE"
        if (station == Postaja.P5) return "MOON"
        return "PARTY"
    }

    //% blockHidden=true
    export function start(selected: Postaja): void {
        station = selected
        radio.setGroup(RADIO_GROUP)
        ensureRings()
        resetState(false)
        basic.forever(function () {
            sampleStation()
            updatePersistentEffect()
            basic.pause(50)
        })
    }

    //% blockHidden=true
    export function playSound(sound: CarobniZvok): void {
        if (!solved || party) return
        let soundGeneration = generation
        let first = 220 + sound * 73
        let second = first + 147
        music.playTone(first, 120)
        if (soundGeneration != generation || party) return
        music.playTone(second, 180)
    }

    //% blockHidden=true
    export function runEffect(): void {
        if (!solved || party) return
        let effectGeneration = generation
        if (station == Postaja.P1) {
            pins.digitalWritePin(DigitalPin.P0, 1)
        } else if (station == Postaja.P2) {
            basic.showString("BOO", 100)
        } else if (station == Postaja.P3) {
            pins.digitalWritePin(DigitalPin.P0, 1)
        } else if (station == Postaja.P4) {
            ring1.setBrightness(140)
            ring1.showColor(neopixel.rgb(0, 255, 0))
        } else if (station == Postaja.P5) {
            ring0.setBrightness(80)
            ring0.showColor(neopixel.rgb(255, 128, 0))
        } else {
            for (let level = 0; level <= 80; level += 2) {
                if (party || effectGeneration != generation) return
                ring0.setBrightness(level)
                ring0.showColor(neopixel.rgb(255, 180, 24))
                basic.pause(125)
            }
        }
    }

    //% blockHidden=true
    export function wakeNext(): void {
        if (!solved || party) return
        sendThree(nextSignal())
        if (station == Postaja.P6) party = true
    }

    function sampleStation(): void {
        if (!active || solved || party) return
        if (station == Postaja.P1) sampleLight()
        else if (station == Postaja.P2) sampleTilt()
        else if (station == Postaja.P3) sampleSound()
        else if (station == Postaja.P4) sampleMagnet()
    }

    function sampleLight(): void {
        if (input.lightLevel() > lightBaseline + LIGHT_DELTA) complete()
    }

    function sampleTilt(): void {
        let x = input.acceleration(Dimension.X)
        let strength = input.acceleration(Dimension.Strength)
        if (strength <= 0) return
        let normalized = Math.idiv(x * 1000, strength)
        let previousStep = tiltStep
        if (tiltStep == 0 && normalized < -TILT_RATIO_PERMILLE) {
            tiltStep = 1
            showInstruction()
        } else if (tiltStep == 1 && normalized > TILT_RATIO_PERMILLE) {
            tiltStep = 2
            levelSince = -1
            showInstruction()
        } else if (tiltStep == 2) {
            if (Math.abs(normalized) <= LEVEL_RATIO_PERMILLE) {
                if (levelSince < 0) levelSince = input.runningTime()
                if (input.runningTime() - levelSince >= LEVEL_HOLD_MS) complete()
            } else {
                levelSince = -1
            }
        }
        if (tiltStep != previousStep) music.playTone(261 + tiltStep * 131, 60)
    }

    function sampleSound(): void {
        if (input.soundLevel() > SOUND_THRESHOLD) loudSamples += 1
        else loudSamples = 0
        if (loudSamples >= SOUND_SAMPLES) complete()
    }

    function sampleMagnet(): void {
        let x = input.magneticForce(Dimension.X)
        let y = input.magneticForce(Dimension.Y)
        let z = input.magneticForce(Dimension.Z)
        let near = Math.abs(x - magneticBaselineX) + Math.abs(y - magneticBaselineY) + Math.abs(z - magneticBaselineZ) >= MAGNET_DELTA
        let moving = Math.abs(x - previousX) + Math.abs(y - previousY) + Math.abs(z - previousZ) >= MOTION_DELTA
        previousX = x
        previousY = y
        previousZ = z
        if (near && moving) motionMs += 50
        if (motionMs >= MOTION_TARGET_MS) complete()
    }

    function updatePersistentEffect(): void {
        updateHouseHint()
        if (party) {
            led.enable(station != Postaja.P5 || Math.idiv(input.runningTime(), 400) % 2 == 0)
            if (station == Postaja.P1 || station == Postaja.P3) pins.digitalWritePin(DigitalPin.P0, 1)
            if (ring0 != null && station != Postaja.P5) {
                ring0.showRainbow(1, 360)
                ring0.rotate(1)
                ring0.show()
            }
        } else if (solved && station == Postaja.P1) {
            led.enable(Math.idiv(input.runningTime(), 300) % 2 == 0)
            pins.digitalWritePin(DigitalPin.P0, Math.randomRange(0, 100) < 30 ? 1 : 0)
        }
    }

    radio.onReceivedString(function (message) {
        if (message == "RESET") resetState(true)
        else if (message == "PARTY") {
            generation += 1
            party = true
            active = false
            if (station == Postaja.P5) {
                ring0.setBrightness(80)
                ring0.showColor(neopixel.rgb(255, 128, 0))
            }
            basic.showIcon(IconNames.Fabulous)
        } else if (station == Postaja.P2 && message == "STAR" && solved) {
            basic.showIcon(IconNames.Happy)
        } else if (message == incomingSignal() && !active && !solved) activate()
    })

    input.onButtonPressed(Button.A, function () {
        if (!active || solved || party) return
        if (station == Postaja.P3) complete()
        else if (station == Postaja.P5) acceptCode(1)
        else if (station == Postaja.P6) complete()
    })

    input.onButtonPressed(Button.B, function () {
        if (!active || solved || party) return
        if (station == Postaja.P5) acceptCode(2)
    })

    function acceptCode(value: number): void {
        radio.sendString(value == 1 ? "P5_A_PRESS" : "P5_B_PRESS")
        if (hintVisible) basic.clearScreen()
        hintVisible = false
        let expected = codeStep == 1 ? 2 : 1
        if (value == expected) {
            codeStep += 1
            led.plot(codeStep - 1, 4)
            if (codeStep >= 3) complete()
        } else {
            codeStep = 0
            basic.showIcon(IconNames.No, 0)
            hintErrorUntil = input.runningTime() + 300
            showInstruction()
        }
    }
}
