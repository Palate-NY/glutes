// Generates app icons from public/icon-512.png:
//   icon-mac-<n>.png       transparent rounded-square (Apple corner ratio) for desktop PWAs / "any"
//   icon-maskable-<n>.png  full-bleed background with the art inset to the 80% safe zone
// Run: swift scripts/make-icons.swift
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "public")
let srcURL = root.appendingPathComponent("icon-512.png")
guard let src = CGImageSourceCreateWithURL(srcURL as CFURL, nil), let art = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fatalError("cannot read \(srcURL.path)") }

func context(_ n: Int) -> CGContext {
    let cs = CGColorSpace(name: CGColorSpace.sRGB)!
    return CGContext(data: nil, width: n, height: n, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
}
func write(_ ctx: CGContext, _ name: String) {
    let url = root.appendingPathComponent(name)
    let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("write failed \(name)") }
    print("wrote \(name)")
}

for n in [1024, 512, 192, 180] {
    // Rounded square, corners at 22.37% of the side (Apple's app-icon proportion)
    let ctx = context(n)
    let s = CGFloat(n)
    let r = s * 0.2237
    ctx.addPath(CGPath(roundedRect: CGRect(x: 0, y: 0, width: s, height: s), cornerWidth: r, cornerHeight: r, transform: nil))
    ctx.clip()
    ctx.interpolationQuality = .high
    ctx.draw(art, in: CGRect(x: 0, y: 0, width: s, height: s))
    write(ctx, "icon-mac-\(n).png")
}

// Background colour of the art, sampled mid-edge (the source has its own baked-in corners)
func edgeColor(_ img: CGImage) -> CGColor {
    let ctx = context(img.width)
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: img.width, height: img.height))
    let px = ctx.data!.assumingMemoryBound(to: UInt8.self)
    let i = ((img.height / 2) * ctx.bytesPerRow) + 2 * 4   // row: middle, column: 2px from the left edge
    return CGColor(srgbRed: CGFloat(px[i]) / 255, green: CGFloat(px[i+1]) / 255, blue: CGFloat(px[i+2]) / 255, alpha: 1)
}
let bg = edgeColor(art)

for n in [512, 192] {
    // Maskable: background everywhere, art scaled into the 80% safe zone and
    // clipped to its own corner radius so the baked-in corners do not show.
    let ctx = context(n)
    let s = CGFloat(n)
    ctx.setFillColor(bg)
    ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))
    let inset = s * 0.10
    let artRect = CGRect(x: inset, y: inset, width: s - 2*inset, height: s - 2*inset)
    ctx.saveGState()
    let cr = artRect.width * 0.2237
    ctx.addPath(CGPath(roundedRect: artRect, cornerWidth: cr, cornerHeight: cr, transform: nil))
    ctx.clip()
    ctx.interpolationQuality = .high
    ctx.draw(art, in: artRect)
    ctx.restoreGState()
    write(ctx, "icon-maskable-\(n).png")
}
