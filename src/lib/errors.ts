/**
 * What can go wrong in lib, as data. lib knows nothing about languages: it
 * throws a MediaError carrying a code and whatever the message will need,
 * and the store or component that shows it translates (see `describeError`
 * in i18n). That keeps lib loadable in a Worker, where the locale store
 * and the document do not exist.
 */

export type MediaErrorInfo =
  | { code: 'cannotLoadImage'; name: string }
  | { code: 'noVideoTrackInFile' }
  | { code: 'noVideoTrack' }
  | { code: 'cannotDecodeCodec'; codec: string | null }
  | { code: 'frameFailed'; at: number }
  | { code: 'noFrames' }
  | { code: 'cannotEncodeH264' }
  | { code: 'mp4Failed' }

export type MediaErrorCode = MediaErrorInfo['code']

export class MediaError extends Error {
  readonly info: MediaErrorInfo

  constructor(info: MediaErrorInfo) {
    // The message is a fallback for logs; what the user sees comes from the dictionary.
    super(info.code)
    this.name = 'MediaError'
    this.info = info
  }
}

/** Why the source's audio did not make it into an MP4 export. */
export type AudioNote = 'noAudioTrack' | 'unknownAudioCodec' | 'noAudioPackets'
