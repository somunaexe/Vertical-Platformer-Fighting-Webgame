//Inherited extra functionality from the Audio audio class for code readability in index.js.
//Extra properties for audio files are set in the constructor instead
class AudioSFX extends Audio {
    /**
     * Creates a new AudioSFX object, which is an extension of the Audio object.
     * @param {Object} options - Object containing properties for the AudioSFX
     * @param {String} options.src - The source URL of the audio file
     * @param {Number} [options.volume=1.0] - Audio volume, 0.0 to 1.0
     * @param {Boolean} [options.autoplay=false] - Whether the audio should autoplay
     * @param {Boolean} [options.loop=false] - Whether the audio should loop
     */
    constructor({src, volume = 1.0, autoplay = false, loop = false}) {
        super(src);
        this.volume = volume
        this.autoplay = autoplay
        this.loop = loop
    }
}