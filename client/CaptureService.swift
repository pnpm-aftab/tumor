import Foundation
import AppKit
import CoreGraphics

class CaptureService {
    static let shared = CaptureService()
    
    func captureFullScreen(completion: @escaping (NSImage?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            let task = Process()
            task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")

            let tempPath = NSTemporaryDirectory() + "math_fullscreen_\(UUID().uuidString).png"
            task.arguments = ["-x", tempPath]
            defer { try? FileManager.default.removeItem(atPath: tempPath) }

            do {
                try task.run()
                task.waitUntilExit()
            } catch {
                print("CaptureService: Failed to run screencapture: \(error)")
                DispatchQueue.main.async { completion(nil) }
                return
            }

            let image = FileManager.default.fileExists(atPath: tempPath)
                ? NSImage(contentsOfFile: tempPath)
                : nil
            DispatchQueue.main.async { completion(image) }
        }
    }

    func captureArea(frame: NSRect, completion: @escaping (NSImage?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            let center = NSPoint(x: frame.midX, y: frame.midY)

            // Find the screen containing the center point for boundary clamping
            let targetScreen = NSScreen.screens.first(where: { screen in
                NSMouseInRect(center, screen.frame, false)
            }) ?? NSScreen.main ?? NSScreen.screens.first!

            let screenFrame = targetScreen.frame

            // Clamp the provided frame to the target screen bounds
            var rectX = frame.origin.x
            var rectY = frame.origin.y

            rectX = max(screenFrame.minX, min(rectX, screenFrame.maxX - frame.width))
            rectY = max(screenFrame.minY, min(rectY, screenFrame.maxY - frame.height))

            let captureWidth = min(frame.width, screenFrame.maxX - rectX)
            let captureHeight = min(frame.height, screenFrame.maxY - rectY)

            guard captureWidth > 0, captureHeight > 0 else {
                print("CaptureService: Invalid capture dimensions (\(captureWidth), \(captureHeight))")
                DispatchQueue.main.async { completion(nil) }
                return
            }

            let task = Process()
            task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")

            let tempPath = NSTemporaryDirectory() + "math_cursor_area_\(UUID().uuidString).png"
            task.arguments = ["-x", "-R\(rectX),\(rectY),\(captureWidth),\(captureHeight)", tempPath]
            defer { try? FileManager.default.removeItem(atPath: tempPath) }

            do {
                try task.run()
                task.waitUntilExit()

                guard task.terminationStatus == 0 else {
                    print("CaptureService: screencapture exited with status \(task.terminationStatus)")
                    DispatchQueue.main.async { completion(nil) }
                    return
                }
            } catch {
                print("CaptureService: Failed to run screencapture: \(error)")
                DispatchQueue.main.async { completion(nil) }
                return
            }

            let image = FileManager.default.fileExists(atPath: tempPath)
                ? NSImage(contentsOfFile: tempPath)
                : nil
            if image == nil {
                print("CaptureService: Screenshot file not found at \(tempPath)")
            }
            DispatchQueue.main.async { completion(image) }
        }
    }
}
