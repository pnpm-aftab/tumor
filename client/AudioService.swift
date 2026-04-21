import Foundation
import AVFoundation
import Observation
import SwiftUI

@Observable
class AudioService: NSObject, AVAudioRecorderDelegate, AVAudioPlayerDelegate {
    private var audioRecorder: AVAudioRecorder?
    private var audioPlayer: AVAudioPlayer?
    private var timer: Timer?
    
    var currentLevel: Float = 0.0
    var isRecording = false
    var isPlaying = false
    var audioFileURL: URL?
    
    var hasRecordedAudio: Bool {
        return audioFileURL != nil && !isRecording
    }
    
    func startRecording() {
        stopPreview()
        audioFileURL = nil
        
        // On macOS, we use AVCaptureDevice for permission
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            self.setupRecorder()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .audio) { [weak self] granted in
                if granted {
                    DispatchQueue.main.async {
                        self?.setupRecorder()
                    }
                }
            }
        default:
            print("AudioService: Microphone access denied or restricted")
        }
    }
    
    private func setupRecorder() {
        let tempDir = NSTemporaryDirectory()
        let fileName = "math_tutor_audio_\(UUID().uuidString).m4a"
        let url = URL(fileURLWithPath: tempDir).appendingPathComponent(fileName)
        self.audioFileURL = url
        
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 12000,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]
        
        do {
            audioRecorder = try AVAudioRecorder(url: url, settings: settings)
            audioRecorder?.delegate = self
            audioRecorder?.isMeteringEnabled = true
            audioRecorder?.record()
            isRecording = true
            
            startMonitoring()
        } catch {
            print("AudioService: Failed to setup recorder: \(error)")
        }
    }
    
    func stopRecording(completion: @escaping (URL?) -> Void) {
        audioRecorder?.stop()
        stopMonitoring()
        isRecording = false
        completion(audioFileURL)
    }
    
    private func startMonitoring() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.audioRecorder?.updateMeters()
            let decibels = self.audioRecorder?.averagePower(forChannel: 0) ?? -160.0
            let normalized = self.normalizeDecibels(decibels)
            
            withAnimation(.linear(duration: 0.1)) {
                self.currentLevel = normalized
            }
        }
    }
    
    private func stopMonitoring() {
        timer?.invalidate()
        timer = nil
        currentLevel = 0.0
    }
    
    private func normalizeDecibels(_ decibels: Float) -> Float {
        if decibels < -60.0 { return 0.0 }
        if decibels >= 0.0 { return 1.0 }
        return (decibels + 60.0) / 60.0
    }
    
    func playPreview() {
        guard let url = audioFileURL else { return }
        do {
            audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer?.delegate = self
            audioPlayer?.play()
            isPlaying = true
        } catch {
            print("AudioService: Failed to play audio: \(error)")
        }
    }
    
    func stopPreview() {
        audioPlayer?.stop()
        isPlaying = false
    }
    
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        isPlaying = false
    }
    
    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if !flag {
            print("AudioService: Recording finished unsuccessfully")
        }
    }
    
    deinit {
        stopMonitoring()
    }
}
