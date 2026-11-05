import AVFoundation
import CoreVideo

// Короткое видео H.264 с геопозицией и устройством в метаданных, как пишет телефон
let args = CommandLine.arguments
let out = URL(fileURLWithPath: args[1])
let fileType: AVFileType = args.count > 2 && args[2] == "mov" ? .mov : .mp4
try? FileManager.default.removeItem(at: out)
let writer = try! AVAssetWriter(outputURL: out, fileType: fileType)
let w = 160, h = 120
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h,
])
writer.add(input)
func item(_ id: AVMetadataIdentifier, _ value: String) -> AVMetadataItem {
  let m = AVMutableMetadataItem(); m.identifier = id; m.value = value as NSString; m.dataType = kCMMetadataBaseDataType_UTF8 as String; return m
}
writer.metadata = [
  item(.quickTimeMetadataLocationISO6709, "+55.7539+037.6208+150.000/"),
  item(.quickTimeMetadataModel, "SECRET-PHONE-MODEL"),
  item(.quickTimeMetadataCreationDate, "2026-11-01T09:30:00+0300"),
  item(.commonIdentifierLocation, "+55.7539+037.6208/"),
]
writer.startWriting()
writer.startSession(atSourceTime: .zero)
for frame in 0..<30 {
  while !input.isReadyForMoreMediaData { usleep(1000) }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  CVPixelBufferLockBaseAddress(pb!, [])
  let base = CVPixelBufferGetBaseAddress(pb!)!.assumingMemoryBound(to: UInt8.self)
  let stride = CVPixelBufferGetBytesPerRow(pb!)
  for y in 0..<h { for x in 0..<w {
    let p = base + y * stride + x * 4
    p[0] = UInt8((x * 2 + frame * 8) & 255); p[1] = UInt8((y * 2) & 255); p[2] = UInt8((frame * 8) & 255); p[3] = 255
  } }
  CVPixelBufferUnlockBaseAddress(pb!, [])
  adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: 30))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print(writer.status == .completed ? "ok" : "fail \(String(describing: writer.error))")
