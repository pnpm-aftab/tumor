// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "tumor",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "tumor", targets: ["tumor"])
    ],
    targets: [
        .executableTarget(
            name: "tumor",
            path: "client",
            resources: [
                .copy("Resources/katex")
            ]
        )
    ]
)
