enum Postaja {
    //% block="P1 Grobek"
    P1 = 1,
    //% block="P2 Robomonster"
    P2 = 2,
    //% block="P3 Duhec"
    P3 = 3,
    //% block="P4 Kotel"
    P4 = 4,
    //% block="P5 Hisa"
    P5 = 5,
    //% block="P6 Luna"
    P6 = 6
}

enum CarobniZvok {
    //% block="skrivnostni"
    Skrivnostni,
    //% block="robotski"
    Robotski,
    //% block="smeh duhca"
    SmehDuhca,
    //% block="carobni"
    Carobni,
    //% block="zmagovalni"
    Zmagovalni,
    //% block="fanfara"
    Fanfara
}

/**
 * Preprosti bloki za delavnico Zacarana vezja.
 */
//% color=#71368a icon="\uf6e2" block="Zacarana vezja"
//% groups='["Zacetek", "Odziv", "Zakljucek"]'
namespace zacarana {
    /** Izbere postajo in zazene njen skriti motor. */
    //% block="zazeni postajo $postaja"
    //% group="Zacetek" weight=100
    export function zazeniPostajo(postaja: Postaja): void {
        zacaranaRuntime.start(postaja)
    }

    /** Koda v notranjosti se izvede, ko je uganka resena. */
    //% block="ko postaja zazna resitev"
    //% group="Zacetek" weight=90 draggableParameters="reporter"
    export function koJeUgankaResena(handler: () => void): void {
        zacaranaRuntime.setSolvedHandler(handler)
    }

    /** Na matriki pokaze otroski simbol. */
    //% block="pokazi moj simbol $simbol"
    //% group="Odziv" weight=80
    export function pokaziSimbol(simbol: Image): void {
        simbol.showImage(0)
    }

    /** Predvaja izbrani kratki zvok. */
    //% block="zaigraj $zvok zvok"
    //% group="Odziv" weight=70
    export function zaigrajZvok(zvok: CarobniZvok): void {
        zacaranaRuntime.playSound(zvok)
    }

    /** Izvede varen fizicni ucinek trenutne postaje. */
    //% block="izvedi carobni ucinek postaje"
    //% group="Odziv" weight=60
    export function izvediCarobniUcinek(): void {
        zacaranaRuntime.runEffect()
    }

    /** Odda dogovorjeni signal naslednji postaji. */
    //% block="prebudi naslednjo postajo"
    //% group="Zakljucek" weight=50
    export function prebudiNaslednjoPostajo(): void {
        zacaranaRuntime.wakeNext()
    }
}
