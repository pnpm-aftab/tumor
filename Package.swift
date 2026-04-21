// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MathTutor",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "MathTutor", targets: ["MathTutor"])
    ],
    targets: [
        .executableTarget(
            name: "MathTutor",
            path: "client",
            resources: [
                .copy("Resources/katex")
            ]
        )
    ]
)
