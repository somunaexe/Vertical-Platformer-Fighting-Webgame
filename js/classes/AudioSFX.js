class AudioSFX extends Audio {
    constructor({src, volume = 0.1, autoplay = false, loop = false}) {
        super(src);
        this.volume = volume
        this.autoplay = autoplay
        this.loop = loop
    }
}