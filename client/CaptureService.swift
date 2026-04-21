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

    func captureAreaAroundCursor(width: CGFloat = 800, height: CGFloat = 800, completion: @escaping (NSImage?) -> Void) {
        // Hide the highlight window so it doesn't appear in the screenshot
        CursorHighlightManager.shared.stop()
        
        // Brief delay to allow the window to disappear from the screen buffer
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            guard let event = CGEvent(source: nil) else {
                completion(nil)
                return
            }
            
            let mouseLocation = event.location
            let rectX = max(0, mouseLocation.x - (width / 2))
            let rectY = max(0, mouseLocation.y - (height / 2))
            
            let task = Process()
            task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
            
            let tempPath = NSTemporaryDirectory() + "math_cursor_area_\(UUID().uuidString).png"
            task.arguments = ["-x", "-R\(rectX),\(rectY),\(width),\(height)", tempPath]
            
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
    }
}

