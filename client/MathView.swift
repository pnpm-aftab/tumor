import SwiftUI
import WebKit

enum MathViewState: Equatable {
    case loading
    case ready
    case error(String)
}

struct MathView: NSViewRepresentable {
    let latex: String
    var inline: Bool = false
    @Binding var renderState: MathViewState
    
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        
        // Register message handler for communication from JS to Swift
        config.userContentController.add(context.coordinator, name: "mathView")
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        
        if let scrollView = webView.enclosingScrollView {
            scrollView.drawsBackground = false
        }
        
        // Asset discovery
        let cssURL = Bundle.module.url(forResource: "katex.min", withExtension: "css", subdirectory: "katex")
        let katexDirectoryURL = cssURL?.deletingLastPathComponent()
        
        // Validate KaTeX resources are present
        #if DEBUG
        assert(cssURL != nil, "KaTeX CSS resource missing from bundle. Ensure Resources/katex/katex.min.css is included in the build.")
        #endif
        
        let cssPath = cssURL != nil ? "katex.min.css" : "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
        let jsPath = cssURL != nil ? "katex.min.js" : "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"
        
        let escapedLatex = escapedForJSTemplateLiteral(latex)
        let isDarkMode = NSApp.effectiveAppearance.name == .darkAqua
        let textColor = isDarkMode ? "#E5E5E5" : "#2E241F"
        
        let html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="\(cssPath)">
            <style>
                :root {
                    --katex-color: \(textColor);
                }
                body {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin: 0;
                    padding: \(inline ? "2px" : "4px");
                    background-color: transparent;
                    overflow: hidden;
                }
                #math {
                    font-size: 1.2em;
                    color: var(--katex-color);
                    text-align: center;
                    width: 100%;
                }
                .katex-display {
                    margin: 0 !important;
                    overflow-x: auto;
                    overflow-y: hidden;
                }
                #error {
                    color: #FF6B6B;
                    font-family: monospace;
                    font-size: 0.9em;
                }
            </style>
        </head>
        <body>
            <div id="math"></div>
            <script src="\(jsPath)" onerror="handleScriptError()"></script>
            <script>
                window.katexReady = false;
                
                function handleScriptError() {
                    window.webkit.messageHandlers.mathView.postMessage({
                        type: 'error',
                        message: 'Failed to load KaTeX script'
                    });
                }
                
                function renderMath(latex) {
                    if (typeof katex === 'undefined') {
                        return;
                    }
                    try {
                        katex.render(latex, document.getElementById('math'), {
                            throwOnError: true,
                            displayMode: \(inline ? "false" : "true"),
                            trust: true
                        });
                        
                        // Report success and height to Swift
                        const height = document.documentElement.scrollHeight;
                        window.webkit.messageHandlers.mathView.postMessage({
                            type: 'ready',
                            height: height
                        });
                    } catch (e) {
                        document.getElementById('math').innerHTML = '<span id="error">' + escapeHtml(latex) + '</span>';
                        window.webkit.messageHandlers.mathView.postMessage({
                            type: 'error',
                            message: e.message
                        });
                    }
                }
                
                function escapeHtml(text) {
                    return text
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }
                
                // Wait for script to load
                document.currentScript.onload = function() {
                    window.katexReady = true;
                    renderMath(`\(escapedLatex)`);
                };
                
                // Fallback: try rendering after DOMContentLoaded
                document.addEventListener('DOMContentLoaded', function() {
                    if (window.katexReady) return;
                    setTimeout(function() {
                        if (typeof katex !== 'undefined') {
                            window.katexReady = true;
                            renderMath(`\(escapedLatex)`);
                        }
                    }, 100);
                });
            </script>
        </body>
        </html>
        """
        
        webView.loadHTMLString(html, baseURL: katexDirectoryURL)
        context.coordinator.webView = webView
        renderState = .loading
        
        return webView
    }
    
    func updateNSView(_ nsView: WKWebView, context: Context) {
        let escapedLatex = escapedForJSTemplateLiteral(latex)
        let isDarkMode = NSApp.effectiveAppearance.name == .darkAqua
        let textColor = isDarkMode ? "#E5E5E5" : "#2E241F"
        
        let updateScript = """
            renderMath(`\(escapedLatex)`);
            document.documentElement.style.setProperty('--katex-color', '\(textColor)');
        """
        
        nsView.evaluateJavaScript(updateScript) { result, error in
            if let error = error {
                DispatchQueue.main.async {
                    self.renderState = .error(error.localizedDescription)
                }
            }
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(renderState: $renderState)
    }
    
    // Proper JS template literal escaping
    private func escapedForJSTemplateLiteral(_ string: String) -> String {
        string
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")
            .replacingOccurrences(of: "$", with: "\\$")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "\t", with: "\\t")
    }
    
    class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        @Binding var renderState: MathViewState
        weak var webView: WKWebView?
        
        init(renderState: Binding<MathViewState>) {
            self._renderState = renderState
        }
        
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let type = body["type"] as? String else { return }
            
            DispatchQueue.main.async {
                switch type {
                case "ready":
                    self.renderState = .ready
                case "error":
                    if let message = body["message"] as? String {
                        self.renderState = .error(message)
                    } else {
                        self.renderState = .error("Unknown rendering error")
                    }
                default:
                    break
                }
            }
        }
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Navigation completed successfully
        }
        
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.renderState = .error(error.localizedDescription)
            }
        }
        
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.renderState = .error(error.localizedDescription)
            }
        }
    }
}


