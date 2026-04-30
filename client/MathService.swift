import Foundation
import AppKit
import Observation

private let backendLLMTimeoutSeconds: TimeInterval = 50.0
private let clientTimeoutBufferSeconds: TimeInterval = 15.0
private let tutorRequestTimeoutSeconds = backendLLMTimeoutSeconds + clientTimeoutBufferSeconds

struct TutoringResult: Equatable {
    let problemSummary: String
    let parsedExpressionLatex: String?
    let summary: String
    var steps: [TutorStep]
    let finalAnswer: String
    let conceptSummary: String
    let confidence: String
    let verification: VerificationStatus?
}

struct TutorStep: Identifiable, Equatable {
    let id: String
    let title: String
    let explanationMarkdown: String
    let latex: String?
    let stepType: String

    init(id: String = UUID().uuidString, title: String, explanationMarkdown: String, latex: String?, stepType: String) {
        self.id = id
        self.title = title
        self.explanationMarkdown = explanationMarkdown
        self.latex = latex
        self.stepType = stepType
    }
}

struct VerificationStatus: Equatable {
    let status: String
    let notes: [String]?
}

enum ScreenCaptureMode {
    case none
    case fullscreen
    case cursorArea
    
    var next: ScreenCaptureMode {
        switch self {
        case .none: return .cursorArea
        case .cursorArea: return .fullscreen
        case .fullscreen: return .none
        }
    }
}

@Observable
class MathService {
    var capturedImage: NSImage?
    var isLoading: Bool = false
    var errorMessage: String?
    var currentResult: TutoringResult?
    var recentQuestions: [String] = []
    var screenContextStatus: String = "Screen context is captured automatically when you send."
    var captureMode: ScreenCaptureMode = .fullscreen
    var lastSubmittedCaptureFrame: NSRect?
    
    // Store original submission for refinement
    private var lastQuestion: String = ""
    private var lastBase64Image: String? = nil
    
    init() {
        self.recentQuestions = UserDefaults.standard.stringArray(forKey: "recentQuestions") ?? []
    }
    
    func saveToHistory(question: String) {
        if !question.isEmpty && !recentQuestions.contains(question) {
            recentQuestions.insert(question, at: 0)
            if recentQuestions.count > 10 {
                recentQuestions.removeLast()
            }
            UserDefaults.standard.set(recentQuestions, forKey: "recentQuestions")
        }
    }
    
    func clearImage() {
        self.capturedImage = nil
        self.lastBase64Image = nil
        self.screenContextStatus = "Screen context is captured automatically when you send."
    }
    
    func submit(question: String, audioURL: URL? = nil, completion: @escaping () -> Void) {
        self.isLoading = true
        self.errorMessage = nil
        self.saveToHistory(question: question)

        let processSubmission = { (base64Image: String?, base64Audio: String?) in
            self.lastQuestion = question
            self.lastBase64Image = base64Image
            
            var payload: [String: Any] = [
                "questionText": question
            ]
            if let img = base64Image { payload["screenshotImage"] = img }
            if let audio = base64Audio { payload["audioFile"] = audio }
            
            self.sendRequest(payload: payload, completion: completion)
        }

        var base64Audio: String? = nil
        if let audioURL = audioURL {
            base64Audio = try? Data(contentsOf: audioURL).base64EncodedString()
        }

        if self.captureMode == .fullscreen {
            self.lastSubmittedCaptureFrame = nil
            CaptureService.shared.captureFullScreen { [weak self] img in
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.capturedImage = img
                    let base64Image = self.base64Png(from: img)
                    self.screenContextStatus = base64Image == nil
                        ? "Full screen context could not be captured."
                        : "Full screen context captured."
                    processSubmission(base64Image, base64Audio)
                }
            }
        } else if self.captureMode == .cursorArea {
            let captureFrame = CursorHighlightManager.shared.currentCaptureFrame
            self.lastSubmittedCaptureFrame = captureFrame
            CursorHighlightManager.shared.persistSelection(frame: captureFrame)
            // Keep cursor highlight persistent - don't stop it during capture
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                CaptureService.shared.captureArea(frame: captureFrame) { [weak self] img in
                    DispatchQueue.main.async {
                        guard let self else { return }
                        self.capturedImage = img
                        let base64Image = self.base64Png(from: img)
                        self.screenContextStatus = base64Image == nil
                            ? "Cursor area context could not be captured."
                            : "Cursor area context captured."
                        processSubmission(base64Image, base64Audio)
                        // Cursor highlight remains active throughout the session
                    }
                }
            }
        } else {
            self.lastSubmittedCaptureFrame = nil
            processSubmission(nil, base64Audio)
        }
    }

    private func sendRequest(payload: [String: Any], completion: @escaping () -> Void) {
        guard let url = URL(string: "http://localhost:3000/api/tutor") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        request.timeoutInterval = tutorRequestTimeoutSeconds
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.isLoading = false
                
                if let error = error {
                    print("Request error: \(error.localizedDescription)")
                    self.errorMessage = error.localizedDescription
                    self.applyFallbackResult()
                    completion()
                    return
                }
                
                guard let data = data else {
                    self.errorMessage = "No data received."
                    self.applyFallbackResult()
                    completion()
                    return
                }
                
                if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
                    print("Server error: \(httpResponse.statusCode)")
                    self.errorMessage = "Server error (\(httpResponse.statusCode))"
                    self.applyFallbackResult()
                    completion()
                    return
                }
                
                do {
                    if let rawJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let result = self.repairResult(from: rawJson) {
                        self.currentResult = result
                        NotificationCenter.default.post(name: .showResult, object: nil)
                    } else {
                        self.applyFallbackResult()
                        NotificationCenter.default.post(name: .showResult, object: nil)
                    }
                    completion()
                }
            }
        }.resume()
    }

    private func applyFallbackResult() {
        self.currentResult = TutoringResult(
            problemSummary: "Connection Issues Detected",
            parsedExpressionLatex: nil,
            summary: "I'm having trouble connecting to the tutoring server.",
            steps: [
                TutorStep(
                    id: "error-step-1",
                    title: "Could Not Reach Tutor",
                    explanationMarkdown: "The math tutor is currently experiencing connection issues. This often happens if the backend server is not running or if there's a network problem.\n\n**Troubleshooting:**\n1. Ensure the Node.js backend is running (`node server.js`)\n2. Check your internet connection\n3. Try again in a moment",
                    latex: nil,
                    stepType: "setup"
                )
            ],
            finalAnswer: "Unable to calculate at this time.",
            conceptSummary: "Please check your backend connection.",
            confidence: "low",
            verification: VerificationStatus(status: "failed", notes: ["Request failed or timed out"])
        )
    }

    private func repairResult(from json: [String: Any]) -> TutoringResult? {
        let problemSummary = json["problemSummary"] as? String ?? "Math Problem Solution"
        let parsedExpressionLatex = json["parsedExpressionLatex"] as? String
        let summary = json["summary"] as? String ?? "Here is the solution."
        let finalAnswer = json["finalAnswer"] as? String ?? "Check the steps for the solution."
        let conceptSummary = json["conceptSummary"] as? String ?? "Mathematical reasoning."
        let confidence = json["confidence"] as? String ?? "low"
        
        var steps: [TutorStep] = []
        if let rawSteps = json["steps"] as? [[String: Any]] {
            for (index, stepJson) in rawSteps.enumerated() {
                let title = stepJson["title"] as? String ?? "Step"
                let explanation = stepJson["explanationMarkdown"] as? String ?? "Explaining the mathematical transformation."
                let latex = stepJson["latex"] as? String
                let type = stepJson["stepType"] as? String ?? "computation"
                steps.append(TutorStep(id: "repaired-step-\(index)", title: title, explanationMarkdown: explanation, latex: latex, stepType: type))
            }
        }
        
        if steps.isEmpty {
            steps.append(TutorStep(id: "repaired-fallback-step", title: "Solution", explanationMarkdown: "The problem was analyzed, but detailed steps were not fully parsed.", latex: nil, stepType: "setup"))
        }
        
        var verification: VerificationStatus? = nil
        if let verJson = json["verification"] as? [String: Any] {
            let status = verJson["status"] as? String ?? "partial"
            let notes = verJson["notes"] as? [String]
            verification = VerificationStatus(status: status, notes: notes)
        }
        
        return TutoringResult(
            problemSummary: problemSummary,
            parsedExpressionLatex: parsedExpressionLatex,
            summary: summary,
            steps: steps,
            finalAnswer: finalAnswer,
            conceptSummary: conceptSummary,
            confidence: confidence,
            verification: verification
        )
    }

    private func base64Png(from image: NSImage?) -> String? {
        guard
            let image,
            let tiff = image.tiffRepresentation,
            let bitmap = NSBitmapImageRep(data: tiff),
            let jpegData = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.5])
        else {
            return nil
        }
        return jpegData.base64EncodedString()
    }
}
