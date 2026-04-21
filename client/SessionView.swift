import SwiftUI
import AppKit

enum SessionMode {
    case text
    case audio
}

struct SessionView: View {
    @Bindable var mathService: MathService
    @State private var audioService = AudioService()
    @State private var questionText: String = ""
    @FocusState private var isTextFieldFocused: Bool
    
    @State var mode: SessionMode = .text
    
    var body: some View {
        ZStack(alignment: .bottom) {
            // Error Banner
            if let errorMessage = mathService.errorMessage {
                VStack {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text(errorMessage)
                            .font(.system(size: 14, weight: .medium))
                        Spacer()
                        Button(action: {
                            mathService.errorMessage = nil
                        }) {
                            Image(systemName: "xmark")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(Theme.textSecondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(Theme.cornerRadius)
                    .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Color.orange.opacity(0.3), lineWidth: 1))
                    Spacer()
                }
                .padding(.top, 16)
                .padding(.horizontal, 30)
                .zIndex(10)
            }
            
            // THE PAGE CONTENT (Coupled only when generated)
            if let result = mathService.currentResult {
                ResultPageContentView(result: result, mathService: mathService)
                    .padding(.bottom, 72) // Pill height (60) + Spacing (12)
                    .transition(.opacity)
                    .zIndex(1)
            }
            
            // THE PILL (Always at bottom - stationary)
            HStack(spacing: 16) {
                modeSwitchButton
                contentArea
                trailingButtons
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(height: 60)
            .frame(width: 500)
            .modernPillStyle()
            .zIndex(2) // Keep pill on top, prevent it from being affected by result page transitions
        }
        .padding(.horizontal, 30)
        .padding(.bottom, 30)
        .padding(.top, 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .onChange(of: mathService.currentResult) { _, _ in repositionPanel() }
        .onChange(of: mathService.captureMode) { _, newMode in
            if newMode == .cursorArea {
                CursorHighlightManager.shared.start()
            } else {
                CursorHighlightManager.shared.stop()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .configureSessionText)) { note in
            configureText(note.object as? String)
        }
        .onReceive(NotificationCenter.default.publisher(for: .configureSessionAudio)) { _ in
            configureAudio()
        }
        .onAppear {
            if mathService.captureMode == .cursorArea {
                CursorHighlightManager.shared.start()
            }
        }
        .onDisappear {
            CursorHighlightManager.shared.stop()
        }
    }
    
    private var modeSwitchButton: some View {
        HStack(spacing: 8) {
            Button(action: toggleMode) {
                ZStack {
                    if mode == .text {
                        Image(systemName: "keyboard")
                    } else {
                        Image(systemName: "mic.fill")
                    }
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(audioService.isRecording ? Theme.base.opacity(0.6) : Theme.base)
                .frame(width: 32, height: 32)
                .background(Theme.textPrimary)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .opacity(audioService.isRecording ? 0.7 : 1.0)
            }
            .buttonStyle(.plain)
            .disabled(audioService.isRecording)
        }
    }
    
    private var trailingButtons: some View {
        HStack(spacing: 8) {
            Button(action: { 
                withAnimation(Theme.morphSpring) {
                    mathService.captureMode = mathService.captureMode.next
                }
            }) {
                Image(systemName: captureModeIcon(mode: mathService.captureMode))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(mathService.captureMode != .none ? Theme.accent : Theme.textSecondary.opacity(0.3))
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            
            actionButtons
        }
    }
    
    private func configureText(_ text: String?) {
        withAnimation(Theme.morphSpring) {
            mode = .text
            questionText = text ?? ""
            isTextFieldFocused = true
        }
    }
    
    private func configureAudio() {
        withAnimation(Theme.morphSpring) {
            mode = .audio
            audioService.startRecording()
        }
    }
    
    @ViewBuilder
    private var contentArea: some View {
        ZStack(alignment: .leading) {
            if mode == .text {
                TextField("Type a question...", text: $questionText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(Theme.textPrimary)
                    .focused($isTextFieldFocused)
                    .onSubmit {
                        if !questionText.isEmpty { submitQuestion() }
                    }
            } else {
                HStack(spacing: 12) {
                    HStack(spacing: 6) {
                        if audioService.isRecording {
                            Circle().fill(.red).frame(width: 6, height: 6)
                                .animation(.easeInOut(duration: 0.5).repeatForever(), value: audioService.isRecording)
                            Text("Listening...")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(Theme.accent)
                        } else if audioService.hasRecordedAudio {
                            if audioService.isPlaying {
                                Image(systemName: "speaker.wave.2.fill")
                                    .foregroundColor(Theme.accent)
                                Text("Playing preview...")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(Theme.accent)
                            } else {
                                Text("Ready to submit")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(Theme.textPrimary)
                            }
                        } else if mathService.isLoading {
                            Text("Processing...")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(Theme.accent)
                        } else {
                            Text("Tap mic to record")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(Theme.textSecondary.opacity(0.6))
                        }
                    }
                    Spacer()
                    if audioService.isRecording {
                        WaveformView(level: audioService.currentLevel)
                    }
                }
            }
        }
    }
    
    @ViewBuilder
    private var actionButtons: some View {
        ZStack {
            if mathService.isLoading {
                ProgressView().controlSize(.small)
            } else if mode == .text && !questionText.isEmpty {
                Button(action: submitQuestion) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(Theme.base)
                        .frame(width: 32, height: 32)
                        .background(Theme.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
            } else if mode == .audio && audioService.isRecording {
                Button(action: {
                    audioService.stopRecording { _ in }
                }) {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(Theme.base)
                        .frame(width: 32, height: 32)
                        .background(Theme.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
            } else if mode == .audio && audioService.hasRecordedAudio {
                HStack(spacing: 8) {
                    Button(action: {
                        audioService.stopPreview()
                        audioService.audioFileURL = nil
                    }) {
                        Image(systemName: "trash")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(Theme.textSecondary)
                            .frame(width: 32, height: 32)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 2))
                    }
                    .buttonStyle(.plain)

                    Button(action: {
                        if audioService.isPlaying {
                            audioService.stopPreview()
                        } else {
                            audioService.playPreview()
                        }
                    }) {
                        Image(systemName: audioService.isPlaying ? "stop.fill" : "play.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(Theme.textPrimary)
                            .frame(width: 32, height: 32)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 2))
                    }
                    .buttonStyle(.plain)
                    
                    Button(action: submitRecordedAudio) {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(Theme.base)
                            .frame(width: 32, height: 32)
                            .background(Theme.textPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                }
            } else {
                Button(action: { 
                    NotificationCenter.default.post(name: .dismissSession, object: nil)
                    mathService.currentResult = nil
                    questionText = ""
                    audioService.audioFileURL = nil
                    audioService.stopPreview()
                }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(Theme.textSecondary)
                        .frame(width: 32, height: 32)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 2))
                }
                .buttonStyle(.plain)
            }
        }
    }
    
    private func captureModeIcon(mode: ScreenCaptureMode) -> String {
        switch mode {
        case .none: return "camera.metering.none"
        case .cursorArea: return "camera.viewfinder"
        case .fullscreen: return "macwindow"
        }
    }
    
    private func toggleMode() {
        withAnimation(Theme.morphSpring) {
            mode = (mode == .text) ? .audio : .text
            if mode == .audio {
                audioService.audioFileURL = nil
                audioService.startRecording()
            } else {
                audioService.stopRecording { _ in }
                audioService.stopPreview()
            }
            isTextFieldFocused = (mode == .text)
        }
    }
    
    private func submitQuestion() {
        mathService.submit(question: questionText) { }
    }
    
    private func submitRecordedAudio() {
        guard let url = audioService.audioFileURL else { return }
        audioService.stopPreview()
        mathService.submit(question: "Solve the problem based on my voice instruction.", audioURL: url) { }
    }
    
    private func repositionPanel() {
        DispatchQueue.main.async {
            if let panel = NSApplication.shared.windows.first(where: { $0 is FloatingPanel }) as? FloatingPanel {
                panel.updateSizeAndPosition(isCollapsed: mathService.currentResult == nil)
            }
        }
    }
}

// MARK: - Subviews

struct ResultPageContentView: View {
    let result: TutoringResult
    var mathService: MathService
    @State private var problemMathState: MathViewState = .loading
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button(action: {
                    withAnimation(Theme.morphSpring) {
                        mathService.currentResult = nil
                    }
                }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Theme.textSecondary)
                        .frame(width: 28, height: 28)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 2))
                        .padding(16)
                }
                .buttonStyle(.plain)
            }
            
            ScrollView {
                VStack(alignment: .leading, spacing: 32) {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(result.problemSummary)
                            .font(.system(size: 24, weight: .bold, design: .default))
                            .foregroundColor(Theme.textPrimary)
                        
                        if let latex = result.parsedExpressionLatex, !latex.isEmpty, latex.lowercased() != "n/a" {
                            VStack(alignment: .center) {
                                ZStack {
                                    if case .loading = problemMathState {
                                        ProgressView()
                                            .controlSize(.small)
                                    }
                                    
                                    if case .error(let message) = problemMathState {
                                        HStack(spacing: 8) {
                                            Image(systemName: "exclamationmark.triangle.fill")
                                                .foregroundColor(.red)
                                            Text("Math rendering error")
                                                .font(.system(size: 12))
                                                .foregroundColor(Theme.textSecondary)
                                        }
                                    }
                                    
                                    MathView(latex: latex, inline: false, renderState: $problemMathState)
                                        .opacity(problemMathState == .ready ? 1 : 0)
                                        .allowsHitTesting(false)
                                }
                                .frame(minHeight: 60)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 16)
                            }
                            .background(Theme.surface)
                            .cornerRadius(Theme.cornerRadius)
                            .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Theme.border, lineWidth: 2))
                        }
                    }
                    
                    Divider().background(Theme.border)
                    
                    VStack(alignment: .leading, spacing: 32) {
                        ForEach(result.steps) { step in
                            StepView(step: step)
                        }
                    }
                    
                    Divider().background(Theme.border)
                    
                    FooterView(result: result, mathService: mathService)
                }
                .padding(EdgeInsets(top: 0, leading: 40, bottom: 40, trailing: 40))
            }
        }
        .frame(width: 700)
        .frame(minHeight: 200, maxHeight: 600)
        .modernPanelStyle()
    }
}

struct StepView: View {
    let step: TutorStep
    @State private var mathState: MathViewState = .loading
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline) {
                Text(step.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Theme.textPrimary)
                Spacer()
                Text(step.stepType.lowercased())
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Theme.textSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Theme.surface)
                    .cornerRadius(Theme.cornerRadius)
                    .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Theme.border, lineWidth: 2))
            }
            
            if let attributedString = try? AttributedString(markdown: step.explanationMarkdown, options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
                Text(attributedString)
                    .font(.system(size: 15, weight: .regular))
                    .lineSpacing(4)
                    .foregroundColor(Theme.textPrimary.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text(step.explanationMarkdown)
                    .font(.system(size: 15, weight: .regular))
                    .lineSpacing(4)
                    .foregroundColor(Theme.textPrimary.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            if let latex = step.latex, !latex.isEmpty, latex.lowercased() != "n/a" {
                VStack(alignment: .center) {
                    ZStack {
                        if case .loading = mathState {
                            ProgressView()
                                .controlSize(.small)
                        }
                        
                        if case .error(let message) = mathState {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.red)
                                Text("Math rendering error")
                                    .font(.system(size: 12))
                                    .foregroundColor(Theme.textSecondary)
                            }
                        }
                        
                        MathView(latex: latex, inline: false, renderState: $mathState)
                            .opacity(mathState == .ready ? 1 : 0)
                            .allowsHitTesting(false)
                    }
                    .frame(minHeight: 60)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .background(Theme.surface.opacity(0.5))
                .cornerRadius(Theme.cornerRadius)
                .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Theme.border, lineWidth: 2))
            }
        }
    }
}

struct FooterView: View {
    let result: TutoringResult
    @Bindable var mathService: MathService
    @State private var hasCopied = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 32) {
            VStack(alignment: .leading, spacing: 16) {
                Text("Final Answer")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Theme.textSecondary)
                
                HStack {
                    Text(result.finalAnswer)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(Theme.textPrimary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                    Spacer()
                    Button(action: {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(result.finalAnswer, forType: .string)
                    }) {
                        Image(systemName: "doc.on.doc").font(.system(size: 14)).foregroundColor(Theme.textSecondary)
                    }
                    .buttonStyle(.plain).padding(.trailing, 16)
                }
                .background(Theme.surface)
                .cornerRadius(Theme.cornerRadius)
                .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Theme.border, lineWidth: 2))
            }
            
            HStack(spacing: 12) {
                MinimalActionButton(title: "Simpler", icon: "sparkles") { mathService.refineAction(action: "simpler") }
                MinimalActionButton(title: "Detailed", icon: "list.bullet.indent") { mathService.refineAction(action: "detailed") }
                Spacer()
                Button(action: copyFullExplanation) {
                    HStack(spacing: 6) {
                        if hasCopied {
                            Text("Copied").font(.system(size: 12, weight: .medium))
                            Image(systemName: "checkmark").font(.system(size: 12, weight: .semibold))
                        } else {
                            Text("Copy").font(.system(size: 12, weight: .medium))
                            Image(systemName: "doc.on.doc").font(.system(size: 12, weight: .semibold))
                        }
                    }
                    .foregroundColor(hasCopied ? .green : Theme.textPrimary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(hasCopied ? Color.green.opacity(0.1) : Theme.surface)
                    .cornerRadius(Theme.cornerRadius)
                    .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(hasCopied ? Color.green.opacity(0.3) : Theme.border, lineWidth: 2))
                }
                .buttonStyle(.plain)
            }
            
            HStack(spacing: 20) {
                Text(result.conceptSummary)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Theme.textSecondary)
                Spacer()
                if let verification = result.verification {
                    HStack(spacing: 6) {
                        Image(systemName: verification.status == "passed" ? "checkmark.circle.fill" : "questionmark.circle.fill")
                            .foregroundColor(verification.status == "passed" ? .green : .orange)
                        Text(verification.status.capitalized)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Theme.textSecondary)
                    }
                }
            }
        }
    }
    
    private func copyFullExplanation() {
        var fullText = "# \(result.problemSummary)\n\n"
        if let latex = result.parsedExpressionLatex { fullText += "## Problem\n$$\(latex)$)\n\n" }
        fullText += "## Steps\n\n"
        for step in result.steps {
            fullText += "### \(step.title)\n\(step.explanationMarkdown)\n"
            if let stepLatex = step.latex { fullText += "$$\(stepLatex)$)\n" }
            fullText += "\n"
        }
        fullText += "## Final Answer\n**\(result.finalAnswer)**\n\n---\n*Generated by Math Tutor*"
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(fullText, forType: .string)
        withAnimation(Theme.morphSpring) { hasCopied = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { withAnimation(Theme.morphSpring) { hasCopied = false } }
    }
}

struct MinimalActionButton: View {
    let title: String; let icon: String; let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 12, weight: .semibold))
                Text(title).font(.system(size: 12, weight: .medium))
            }
            .foregroundColor(Theme.textPrimary).padding(.horizontal, 12).padding(.vertical, 8)
            .background(Theme.surface)
            .cornerRadius(Theme.cornerRadius)
            .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Theme.border, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }
}

struct WaveformView: View {
    let level: Float
    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<10) { i in
                RoundedRectangle(cornerRadius: 2)
                    .fill(Theme.accent)
                    .frame(width: 3, height: calculateHeight(for: i))
            }
        }
        .animation(.easeInOut(duration: 0.1), value: level)
    }
    private func calculateHeight(for index: Int) -> CGFloat {
        let distance = abs(4.5 - Double(index))
        let multiplier = 1.0 - (distance / 5.0)
        let baseHeight: CGFloat = 4
        let dynamicHeight = CGFloat(level) * 40 * multiplier
        return baseHeight + dynamicHeight
    }
}
