import Foundation
import AppKit
import CoreGraphics

class CaptureService {
    static let shared = CaptureService()
    
    func captureFullScreen(completion: @escaping (NSImage?) -> Void) {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        
        let tempPath = NSTemporaryDirectory() + "math_fullscreen_\(UUID().uuidString).png"
        task.arguments = ["-x", tempPath]
        
        do {
            try task.run()
            task.waitUntilExit()
        } catch {
            print("CaptureService: Failed to run screencapture: \(error)")
            completion(nil)
            return
        }
        
        if FileManager.default.fileExists(atPath: tempPath) {
            if let img = NSImage(contentsOfFile: tempPath) {
                completion(img)
            } else {
                completion(nil)
            }
            try? FileManager.default.removeItem(atPath: tempPath)
        } else {
            completion(nil)
        }
    }

    func captureArea(frame: NSRect, completion: @escaping (NSImage?) -> Void) {
        DispatchQueue.main.async {
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
                completion(nil)
                return
            }

            let task = Process()
            task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")

            let tempPath = NSTemporaryDirectory() + "math_cursor_area_\(UUID().uuidString).png"
            task.arguments = ["-x", "-R\(rectX),\(rectY),\(captureWidth),\(captureHeight)", tempPath]

            do {
                try task.run()
                task.waitUntilExit()

                guard task.terminationStatus == 0 else {
                    print("CaptureService: screencapture exited with status \(task.terminationStatus)")
                    completion(nil)
                    return
                }
            } catch {
                print("CaptureService: Failed to run screencapture: \(error)")
                completion(nil)
                return
            }

            if FileManager.default.fileExists(atPath: tempPath) {
                let img = NSImage(contentsOfFile: tempPath)
                try? FileManager.default.removeItem(atPath: tempPath)
                if img == nil {
                    print("CaptureService: Failed to load captured image from \(tempPath)")
                }
                completion(img)
            } else {
                print("CaptureService: Screenshot file not found at \(tempPath)")
                completion(nil)
            }
        }
    }
}
