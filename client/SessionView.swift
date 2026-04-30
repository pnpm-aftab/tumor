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
    @State private var isMenuExpanded = false
    @State private var isRecentPopoverPresented = false
    
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
                    .background(Theme.accentSoft)
                    .cornerRadius(Theme.cornerRadius)
                    .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Theme.accent.opacity(0.3), lineWidth: 1))
                    Spacer()
                }
                .padding(.top, 16)
                .padding(.horizontal, 30)
                .zIndex(10)
            }
            
            // THE PAGE CONTENT (Coupled only when generated)
            if let result = mathService.currentResult {
                ResultPageContentView(result: result, mathService: mathService, onResize: { repositionPanel() })
                    .padding(.bottom, 72) // Pill height (60) + Spacing (12)
                    .transition(.opacity)
                    .zIndex(1)
            }
            
            // THE PILL (Always at bottom - stationary)
            HStack(spacing: 12) {
                hamburgerButton
                modeToggleButton
                if isMenuExpanded {
                    expandedControlTray
                        .transition(.move(edge: .leading).combined(with: .opacity))
                }
                contentArea
                    .layoutPriority(0)
                actionButtons
                    .layoutPriority(2)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(height: 60)
            .frame(width: pillWidth)
            .modernPillStyle()
            .animation(Theme.morphSpring, value: isMenuExpanded)
            .zIndex(2) // Keep pill on top, prevent it from being affected by result page transitions
        }
        .padding(.horizontal, 30)
        .padding(.bottom, 30)
        .padding(.top, 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .onExitCommand {
            closeSession()
        }
        .onChange(of: isMenuExpanded) { _, _ in repositionPanel() }
        .onChange(of: mathService.currentResult) { _, _ in repositionPanel() }
        .onChange(of: mathService.captureMode) { _, newMode in
            if newMode == .cursorArea {
                configureCursorAreaCallbacks()
                CursorHighlightManager.shared.start()
            } else {
                CursorHighlightManager.shared.onFrameChanged = nil
                CursorHighlightManager.shared.onSelectionLocked = nil
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
                configureCursorAreaCallbacks()
                CursorHighlightManager.shared.start()
            }
        }
        .onDisappear {
            CursorHighlightManager.shared.onFrameChanged = nil
            CursorHighlightManager.shared.onSelectionLocked = nil
            CursorHighlightManager.shared.stop()
        }
    }

    private var pillWidth: CGFloat {
        if isMenuExpanded {
            return 680
        }

        return 420
    }

    private var hamburgerButton: some View {
        Button(action: {
            withAnimation(Theme.morphSpring) {
                isMenuExpanded.toggle()
            }
        }) {
            BrandTrayLabel(
                mark: "t.",
                tint: Theme.textSecondary,
                isActive: isMenuExpanded
            )
        }
        .buttonStyle(.plain)
        .help(isMenuExpanded ? "Hide menu" : "Show menu")
    }

    private var expandedControlTray: some View {
        HStack(spacing: 6) {
            Button(action: {
                isRecentPopoverPresented.toggle()
            }) {
                HoverTrayLabel(icon: "clock.arrow.circlepath", title: "History", tint: Theme.textSecondary, isActive: isRecentPopoverPresented)
                    .help("Recent questions")
            }
            .buttonStyle(.plain)
            .popover(isPresented: $isRecentPopoverPresented, arrowEdge: .bottom) {
                recentQuestionsPopover
            }

            if mode == .audio && audioService.hasRecordedAudio {
                trayButton(
                    icon: audioService.isPlaying ? "stop.fill" : "play.fill",
                    title: audioService.isPlaying ? "Stop Audio" : "Play Audio",
                    help: audioService.isPlaying ? "Stop preview" : "Play preview",
                    tint: Theme.accent,
                    staysExpanded: true,
                    action: {
                        if audioService.isPlaying {
                            audioService.stopPreview()
                        } else {
                            audioService.playPreview()
                        }
                    }
                )

                trayButton(
                    icon: "trash",
                    title: "Discard Audio",
                    help: "Discard recording",
                    tint: Theme.accent,
                    action: {
                        audioService.discardRecording()
                        collapseMenu()
                    }
                )
            }

            trayButton(icon: "plus", title: "New Session", help: "New session", tint: Theme.textSecondary, action: startNewSession)
        }
        .padding(.leading, 2)
    }

    private func trayButton(
        icon: String,
        title: String,
        help: String,
        tint: Color,
        isActive: Bool = false,
        isDisabled: Bool = false,
        staysExpanded: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: {
            action()
            if !staysExpanded {
                collapseMenu()
            }
        }) {
            HoverTrayLabel(icon: icon, title: title, tint: tint, isActive: isActive)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.45 : 1.0)
        .help(help)
    }

    private var recentQuestionsPopover: some View {
        VStack(alignment: .leading, spacing: 6) {
            if mathService.recentQuestions.isEmpty {
                Text("No recent questions")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Theme.textSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
            } else {
                ForEach(mathService.recentQuestions, id: \.self) { question in
                    Button(action: {
                        questionText = question
                        isRecentPopoverPresented = false
                        collapseMenu()
                    }) {
                        Text(question)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Theme.textPrimary)
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(6)
        .frame(width: 260)
        .background(Theme.base)
    }

    private var modeToggleButton: some View {
        Button(action: toggleMode) {
            HoverTrayLabel(
                icon: mode == .text ? "mic.fill" : "keyboard.fill",
                title: mode == .text ? "Use Voice" : "Use Text",
                tint: Theme.accent,
                isActive: true
            )
        }
        .buttonStyle(.plain)
        .disabled(audioService.isRecording)
        .opacity(audioService.isRecording ? 0.45 : 1.0)
        .help(mode == .text ? "Switch to audio" : "Switch to text")
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
            Menu {
                if mathService.recentQuestions.isEmpty {
                    Text("No recent questions")
                } else {
                    ForEach(mathService.recentQuestions, id: \.self) { question in
                        Button(action: {
                            questionText = question
                        }) {
                            Text(question)
                        }
                    }
                }
            } label: {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Theme.textSecondary)
                    .frame(width: 36, height: 36)
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .frame(width: 36, height: 36)

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

            Menu {
                Button("Start New Session", action: startNewSession)

                if mathService.captureMode == .cursorArea {
                    Button("Select Again", action: selectCursorAreaAgain)
                }

                Button("Close Session", action: closeSession)
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(Theme.textSecondary)
                    .frame(width: 36, height: 36)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.controlRadius))
                    .overlay(RoundedRectangle(cornerRadius: Theme.controlRadius).stroke(Theme.border, lineWidth: 2))
            }
            .menuStyle(.borderlessButton)
            .menuIndicator(.hidden)
            .frame(width: 36, height: 36)
            
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
                    .lineLimit(1)
                    .frame(minWidth: 44, maxWidth: .infinity)
                    .layoutPriority(0)
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
                .frame(minWidth: 44, maxWidth: .infinity, alignment: .leading)
                .layoutPriority(0)
            }
        }
        .frame(minWidth: 44, maxWidth: .infinity, alignment: .leading)
        .clipped()
    }
    
    @ViewBuilder
    private var actionButtons: some View {
        HStack(spacing: 8) {
            if mathService.captureMode == .cursorArea {
                Button(action: selectCursorAreaAgain) {
                    HoverTrayLabel(icon: "scope", title: "Reselect Area", tint: Theme.accent, isActive: CursorHighlightManager.shared.isLocked)
                }
                .buttonStyle(.plain)
                .help("Select area again")
            }

            captureModeButton

            if mathService.isLoading {
                ProgressView().controlSize(.small)
            } else if mode == .text && !questionText.isEmpty {
                Button(action: submitQuestion) {
                    HoverTrayLabel(icon: "arrow.up", title: "Ask", tint: Theme.accent, isActive: true)
                }
                .buttonStyle(.plain)
                .help("Ask tutor")
            } else if mode == .audio && audioService.isRecording {
                Button(action: {
                    audioService.stopRecording { _ in }
                }) {
                    HoverTrayLabel(icon: "stop.fill", title: "Stop Recording", tint: Theme.accent, isActive: true)
                }
                .buttonStyle(.plain)
                .help("Stop recording")
            } else if mode == .audio && audioService.hasRecordedAudio {
                Button(action: submitRecordedAudio) {
                    HoverTrayLabel(icon: "arrow.up", title: "Send Audio", tint: Theme.accent, isActive: true)
                }
                .buttonStyle(.plain)
                .help("Send audio")
            } else {
                Button(action: closeSession) {
                    HoverTrayLabel(icon: "xmark", title: "Close", tint: Theme.textSecondary, isActive: false)
                }
                .buttonStyle(.plain)
                .help("Close session")
            }
        }
    }

    private var captureModeButton: some View {
        Button(action: {
            withAnimation(Theme.morphSpring) {
                mathService.captureMode = mathService.captureMode.next
            }
        }) {
            HoverTrayLabel(
                icon: captureModeIcon(mode: mathService.captureMode),
                title: captureModeLabel(mode: mathService.captureMode),
                tint: Theme.accent,
                isActive: mathService.captureMode != .none
            )
        }
        .buttonStyle(.plain)
        .help("Capture: \(captureModeLabel(mode: mathService.captureMode))")
    }
    
    private func captureModeIcon(mode: ScreenCaptureMode) -> String {
        switch mode {
        case .none: return "camera.metering.none"
        case .cursorArea: return "camera.viewfinder"
        case .fullscreen: return "macwindow"
        }
    }

    private func captureModeLabel(mode: ScreenCaptureMode) -> String {
        switch mode {
        case .none: return "No Screen"
        case .cursorArea: return "Cursor Area"
        case .fullscreen: return "Full Screen"
        }
    }
    
    private func toggleMode() {
        setMode(mode == .text ? .audio : .text)
    }

    private func setMode(_ newMode: SessionMode) {
        guard mode != newMode else { return }
        withAnimation(Theme.morphSpring) {
            mode = newMode
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

    private func collapseMenu() {
        withAnimation(Theme.morphSpring) {
            isMenuExpanded = false
        }
    }
    
    private func submitQuestion() {
        mathService.submit(question: questionText) {
            resetComposerAfterAnsweredPrompt(for: .text)
        }
    }
    
    private func submitRecordedAudio() {
        guard let url = audioService.audioFileURL else { return }
        audioService.stopPreview()
        mathService.submit(question: "Solve the problem based on my voice instruction.", audioURL: url) {
            resetComposerAfterAnsweredPrompt(for: .audio)
        }
    }

    private func resetComposerAfterAnsweredPrompt(for submittedMode: SessionMode) {
        switch submittedMode {
        case .text:
            questionText = ""
            isTextFieldFocused = true
        case .audio:
            audioService.stopPreview()
            audioService.audioFileURL = nil

            if mode == .audio {
                audioService.startRecording()
            }
        }
    }

    private func startNewSession() {
        withAnimation(Theme.morphSpring) {
            mathService.currentResult = nil
        }
        mathService.errorMessage = nil
        mathService.clearImage()
        questionText = ""
        audioService.discardRecording()

        if mathService.captureMode == .cursorArea {
            CursorHighlightManager.shared.clearSelection()
        }

        if mode == .audio {
            audioService.startRecording()
        } else {
            isTextFieldFocused = true
        }
        collapseMenu()
    }

    private func selectCursorAreaAgain() {
        guard mathService.captureMode == .cursorArea else { return }
        CursorHighlightManager.shared.clearSelection()
        repositionPanel()
    }

    private func closeSession() {
        if mathService.captureMode == .cursorArea {
            CursorHighlightManager.shared.clearSelection()
            CursorHighlightManager.shared.stop()
        }
        NotificationCenter.default.post(name: .dismissSession, object: nil)
        mathService.currentResult = nil
        questionText = ""
        audioService.discardRecording()
        collapseMenu()
    }
    
    private func repositionPanel() {
        DispatchQueue.main.async {
            if let panel = NSApplication.shared.windows.first(where: { $0 is FloatingPanel }) as? FloatingPanel {
                let isCursorMode = mathService.captureMode == .cursorArea
                let hasResult = mathService.currentResult != nil

                if isCursorMode, CursorHighlightManager.shared.isLocked {
                    let selectionFrame = CursorHighlightManager.shared.currentCaptureFrame
                    panel.updateSizeAndPosition(
                        isCollapsed: !hasResult,
                        anchorRect: selectionFrame,
                        anchorMode: .rightOfSelection
                    )
                } else {
                    panel.updateSizeAndPosition(
                        isCollapsed: !hasResult,
                        anchorRect: nil
                    )
                }
            }
        }
    }

    private func configureCursorAreaCallbacks() {
        CursorHighlightManager.shared.onFrameChanged = { _ in
            guard CursorHighlightManager.shared.isLocked else { return }
            repositionPanel()
        }
        CursorHighlightManager.shared.onSelectionLocked = { _ in
            repositionPanel()
        }
    }
}

// MARK: - Subviews

struct HoverTrayLabel: View {
    let icon: String
    let title: String
    let tint: Color
    let isActive: Bool
    @State private var isHovering = false
    @State private var hoverWorkItem: DispatchWorkItem?

    var body: some View {
        HStack(spacing: isHovering ? 6 : 0) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
                .frame(width: 16, height: 16)

            if isHovering {
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(1)
                    .transition(.opacity.combined(with: .move(edge: .leading)))
            }
        }
        .foregroundColor(isActive ? Theme.base : tint.opacity(0.92))
        .frame(minWidth: 32)
        .frame(height: 32)
        .padding(.horizontal, isHovering ? 9 : 0)
        .background(isActive ? tint.opacity(0.9) : tint.opacity(isHovering ? 0.16 : 0.08))
        .clipShape(RoundedRectangle(cornerRadius: Theme.controlRadius))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.controlRadius)
                .stroke(tint.opacity(isActive ? 0.22 : 0.18), lineWidth: 1.5)
        )
        .contentShape(RoundedRectangle(cornerRadius: Theme.controlRadius))
        .onHover { hovering in
            hoverWorkItem?.cancel()

            if hovering {
                let workItem = DispatchWorkItem {
                    withAnimation(Theme.morphSpring) {
                        isHovering = true
                    }
                }
                hoverWorkItem = workItem
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.12, execute: workItem)
            } else {
                withAnimation(Theme.morphSpring) {
                    isHovering = false
                }
            }
        }
        .onDisappear {
            hoverWorkItem?.cancel()
            isHovering = false
        }
    }
}

struct BrandTrayLabel: View {
    let mark: String
    let tint: Color
    let isActive: Bool

    var body: some View {
        Text(mark)
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .frame(width: 16, height: 16)
        .foregroundColor(isActive ? Theme.base : tint.opacity(0.92))
        .frame(minWidth: 32)
        .frame(height: 32)
        .background(isActive ? tint.opacity(0.9) : tint.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: Theme.controlRadius))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.controlRadius)
                .stroke(tint.opacity(isActive ? 0.22 : 0.18), lineWidth: 1.5)
        )
        .contentShape(RoundedRectangle(cornerRadius: Theme.controlRadius))
    }
}

struct ResultPageContentView: View {
    let result: TutoringResult
    var mathService: MathService
    let onResize: () -> Void
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
                        MathText(text: result.problemSummary, fontSize: 24, fontWeight: .bold, foregroundColor: Theme.textPrimary)
                        
                        if let latex = result.parsedExpressionLatex, !latex.isEmpty, latex.lowercased() != "n/a" {
                            VStack(alignment: .center) {
                                ZStack {
                                    if case .loading = problemMathState {
                                        ProgressView()
                                            .controlSize(.small)
                                    }
                                    
                                    if case .error(_) = problemMathState {
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
                                        .frame(maxWidth: .infinity)
                                }
                                .frame(minHeight: 88)
                                .frame(maxWidth: .infinity)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 12)
                            }
                            .frame(maxWidth: .infinity)
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
                    
                    FooterView(result: result, mathService: mathService, onResize: onResize)
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
            
            MathText(text: step.explanationMarkdown)
            
            if let latex = step.latex, !latex.isEmpty, latex.lowercased() != "n/a" {
                VStack(alignment: .center) {
                    ZStack {
                        if case .loading = mathState {
                            ProgressView()
                                .controlSize(.small)
                        }
                        
                        if case .error(_) = mathState {
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
                            .frame(maxWidth: .infinity)
                    }
                    .frame(minHeight: 78)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }
                .frame(maxWidth: .infinity)
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
    let onResize: () -> Void
    @State private var hasCopied = false
    @State private var showSummary = true
    @State private var showDetails = false
    @State private var summaryMathState: MathViewState = .loading
    
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            AccordionSection(
                title: "Summary",
                subtitle: "Short explanation",
                isExpanded: $showSummary,
                onToggle: onResize
            ) {
                SummaryRenderer(summary: result.summary, mathState: $summaryMathState)
                    .padding(.top, 4)
            }

            AccordionSection(
                title: "Details",
                subtitle: "Final answer and concept notes",
                isExpanded: $showDetails,
                onToggle: onResize
            ) {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Final Answer")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Theme.textSecondary)
                        
                        HStack(alignment: .center, spacing: 12) {
                            MathText(text: result.finalAnswer, fontSize: 18, fontWeight: .bold, foregroundColor: Theme.textPrimary)
                            Spacer(minLength: 0)
                            Button(action: {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(result.finalAnswer, forType: .string)
                            }) {
                                Image(systemName: "doc.on.doc")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(Theme.textSecondary)
                                    .frame(width: 32, height: 32)
                                    .background(Theme.base)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .background(Theme.surface)
                        .cornerRadius(Theme.cornerRadius)
                        .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Theme.border, lineWidth: 2))
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Concept")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Theme.textSecondary)
                        MathText(text: result.conceptSummary, fontSize: 14, fontWeight: .medium, foregroundColor: Theme.textPrimary.opacity(0.8))
                    }
                    
                    if let verification = result.verification {
                        HStack(spacing: 8) {
                            Image(systemName: verification.status == "passed" ? "checkmark.circle.fill" : "questionmark.circle.fill")
                                .foregroundColor(verification.status == "passed" ? .green : .orange)
                            Text("Verification: \(verification.status.capitalized)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(Theme.textSecondary)
                        }
                        .padding(.top, 4)
                    }
                }
            }
            
            Divider().background(Theme.border)
            
            HStack(spacing: 12) {
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
                    .foregroundColor(hasCopied ? Theme.accent : Theme.textPrimary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(hasCopied ? Theme.accentSoft : Theme.surface)
                    .cornerRadius(Theme.cornerRadius)
                    .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(hasCopied ? Theme.accent.opacity(0.3) : Theme.border, lineWidth: 2))
                }
                .buttonStyle(.plain)
            }
        }
    }
    
    private func copyFullExplanation() {
        var fullText = "# \(result.problemSummary)\n\n"
        if let latex = result.parsedExpressionLatex { fullText += "## Problem\n$$\n\(latex)\n$$\n\n" }
        fullText += "## Steps\n\n"
        for step in result.steps {
            fullText += "### \(step.title)\n\(step.explanationMarkdown)\n"
            if let stepLatex = step.latex { fullText += "$$\n\(stepLatex)\n$$\n" }
            fullText += "\n"
        }
        fullText += "## Final Answer\n**\(result.finalAnswer)**\n\n---\n*Generated by tumor*"
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(fullText, forType: .string)
        withAnimation(Theme.morphSpring) { hasCopied = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { withAnimation(Theme.morphSpring) { hasCopied = false } }
    }
}

struct AccordionSection<Content: View>: View {
    let title: String
    let subtitle: String
    @Binding var isExpanded: Bool
    let onToggle: () -> Void
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(Theme.textPrimary)
                        Text(subtitle)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(Theme.textSecondary)
                    }
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Theme.textSecondary)
                        .frame(width: 28, height: 28)
                        .background(Theme.base)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 16) {
                    content
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .background(Theme.surface.opacity(0.45))
        .cornerRadius(Theme.cornerRadius)
        .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Theme.border, lineWidth: 2))
    }

    private func toggle() {
        withAnimation(Theme.morphSpring) {
            isExpanded.toggle()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            onToggle()
        }
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

// MARK: - Math Text Renderer

/// Renders text containing inline ($...$) and display ($$...$$) LaTeX as mixed Text + MathView.
struct MathText: View {
    let text: String
    var fontSize: CGFloat = 15
    var fontWeight: Font.Weight = .regular
    var foregroundColor: Color = Theme.textPrimary.opacity(0.85)
    var latexBackgroundColor: Color = Theme.surface.opacity(0.5)
    var latexPadding: CGFloat = 12
    var latexMinHeight: CGFloat = 64

    @State private var renderStates: [Int: MathViewState] = [:]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(parsedComponents.indices, id: \.self) { index in
                let component = parsedComponents[index]
                switch component.kind {
                case .text:
                    if !component.content.isEmpty {
                        if let attributed = try? AttributedString(
                            markdown: component.content,
                            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
                        ) {
                            Text(attributed)
                                .font(.system(size: fontSize, weight: fontWeight))
                                .foregroundColor(foregroundColor)
                                .lineSpacing(4)
                                .fixedSize(horizontal: false, vertical: true)
                        } else {
                            Text(component.content)
                                .font(.system(size: fontSize, weight: fontWeight))
                                .foregroundColor(foregroundColor)
                                .lineSpacing(4)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                case .inlineLatex:
                    mathView(for: index, latex: component.content, inline: true)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                case .displayLatex:
                    mathView(for: index, latex: component.content, inline: false)
                        .padding(.horizontal, latexPadding)
                        .padding(.vertical, 10)
                        .frame(minHeight: latexMinHeight)
                        .frame(maxWidth: .infinity)
                        .background(latexBackgroundColor)
                        .cornerRadius(Theme.cornerRadius)
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.cornerRadius)
                                .stroke(Theme.border.opacity(0.5), lineWidth: 1)
                        )
                }
            }
        }
    }

    @ViewBuilder
    private func mathView(for index: Int, latex: String, inline: Bool) -> some View {
        let state = Binding(
            get: { renderStates[index] ?? .loading },
            set: { renderStates[index] = $0 }
        )
        ZStack {
            if case .loading = state.wrappedValue {
                ProgressView().controlSize(.small)
            }
            if case .error(_) = state.wrappedValue {
                Text(latex)
                    .font(.system(size: fontSize - 1, weight: .medium, design: .monospaced))
                    .foregroundColor(.red.opacity(0.7))
            }
            MathView(latex: latex, inline: inline, renderState: state)
                .opacity(state.wrappedValue == .ready ? 1 : 0)
                .allowsHitTesting(false)
                .frame(maxWidth: inline ? nil : .infinity)
        }
        .frame(maxWidth: inline ? nil : .infinity)
    }

    private enum ComponentKind { case text, inlineLatex, displayLatex }
    private struct TextComponent { let kind: ComponentKind; let content: String }

    private var parsedComponents: [TextComponent] {
        var components: [TextComponent] = []
        // Pattern matches: $$...$$ (display) or $...$ (inline, single-line, no $$)
        let pattern = #"\$\$([^$]+)\$\$|\$([^$\n]+)\$"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return [TextComponent(kind: .text, content: text)]
        }

        let range = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, options: [], range: range)
        var lastEnd = text.startIndex

        for match in matches {
            // Text before this match
            if let matchStart = Range(match.range, in: text)?.lowerBound, lastEnd < matchStart {
                let snippet = String(text[lastEnd..<matchStart]).trimmingCharacters(in: .whitespacesAndNewlines)
                if !snippet.isEmpty { components.append(TextComponent(kind: .text, content: snippet)) }
            }
            // Display math ($$...$$) is group 1, inline ($...$) is group 2
            if let displayRange = Range(match.range(at: 1), in: text) {
                let latex = String(text[displayRange]).trimmingCharacters(in: .whitespacesAndNewlines)
                if !latex.isEmpty { components.append(TextComponent(kind: .displayLatex, content: latex)) }
            } else if let inlineRange = Range(match.range(at: 2), in: text) {
                let latex = String(text[inlineRange]).trimmingCharacters(in: .whitespacesAndNewlines)
                if !latex.isEmpty { components.append(TextComponent(kind: .inlineLatex, content: latex)) }
            }
            if let matchEnd = Range(match.range, in: text)?.upperBound { lastEnd = matchEnd }
        }
        // Remaining text after last match
        if lastEnd < text.endIndex {
            let remaining = String(text[lastEnd...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !remaining.isEmpty { components.append(TextComponent(kind: .text, content: remaining)) }
        }
        if components.isEmpty && !text.isEmpty {
            components.append(TextComponent(kind: .text, content: text))
        }
        return components
    }
}

// MARK: - Summary Renderer

struct SummaryRenderer: View {
    let summary: String
    @Binding var mathState: MathViewState // kept for caller compatibility

    var body: some View {
        MathText(
            text: summary,
            fontSize: 17,
            fontWeight: .medium,
            foregroundColor: Theme.textPrimary,
            latexBackgroundColor: Theme.surface.opacity(0.3)
        )
    }
}
