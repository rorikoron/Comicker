use std::path::{Path, PathBuf};
use std::fs::{self, File};
use specta::Type;
use serde::{Deserialize, Serialize};
use image::GenericImageView;
use png::{Encoder, ColorType, BitDepth};
use std::io::BufWriter;
mod typst_lib;

pub use typst_lib::TypstWrapperWorld;
use typst_pdf::PdfOptions;

#[derive(Deserialize, Serialize, Type, Clone)]
pub enum ConvertPaperType{
    B5,
    A5,
}
#[derive(serde::Deserialize, Clone)]
pub struct ConvertParams {
    pub width: f64,
    pub height: f64,
}
#[derive(Serialize, Clone)]
pub struct ProgressPayload {
    pub current: usize,
    pub total: usize,
}

#[derive(Deserialize, Serialize, Type, Clone)]
#[serde(tag = "type", content = "path")]
pub enum MergeItem {
    Image(String),
    Blank,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn calculate_target_dimensions(width_mm: f64, height_mm: f64, bleed_mm: f64, dpi: f64) -> (u32, u32) {
    let ppmm = dpi / 25.4;
    let new_w = ((width_mm + bleed_mm * 2.0) * ppmm).round() as u32;
    let new_h = ((height_mm + bleed_mm * 2.0) * ppmm).round() as u32;
    (new_w, new_h)
}

fn get_bleed_size(format: ConvertPaperType) -> ConvertParams {
    match format {
        ConvertPaperType::B5 => ConvertParams { width: 182.0, height: 257.0 },
        ConvertPaperType::A5 => ConvertParams { width: 148.0, height: 210.0 },
    }
}

fn get_dpi_and_pixel_dims(input_path: String) -> Result<(f64, Option<png::PixelDimensions>), String> {
    let file = File::open(&input_path).map_err(|e| e.to_string())?;
    let decoder = png::Decoder::new(file);
    let reader = decoder.read_info().map_err(|e| e.to_string())?;
    
    let pixel_dims = reader.info().pixel_dims;


    if let Some(dims) = pixel_dims {
        if dims.unit == png::Unit::Meter {
            // pixels per meter * 0.0254 meters per inch = DPI
            return Ok(((dims.xppu as f64 * 0.0254).round(), pixel_dims));
        }
    }
    Ok((600.0, None)) // Default to 600 DPI
}

#[tauri::command]
async fn bleed_image(input_path: String, output_path: String, convert_type: ConvertPaperType, bleed_amount: u32) -> Result<String, String> {
    // 画像データのデコード
    let img = image::open(&input_path).map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    
    // 2. 切り抜きサイズの計算
    let params = get_bleed_size(convert_type);

    // pixel_dimsからDPIを取得、またはデフォルトを使用
    let (dpi, pixel_dims) = get_dpi_and_pixel_dims(input_path)?;

    // DPIから1mmあたりのピクセル数（ppmm）を算出
    // 1 inch = 25.4 mm
    let (new_w, new_h) = calculate_target_dimensions(params.width, params.height, bleed_amount as f64, dpi);

    if w < new_w || h < new_h {
        return Err(format!("画像サイズが不足しています: 必要なサイズ {}x{}, 元のサイズ {}x{}", new_w, new_h, w, h));
    }

    // 3. クロップ処理
    let subimg = img.view(w/2 - new_w/2, h/2 - new_h/2, new_w, new_h).to_image();

    // 4. 保存処理
    let path = Path::new(&output_path);
    let output_file = File::create(path).map_err(|e| e.to_string())?;
    let ref mut w_buf = BufWriter::new(output_file);

    let mut encoder = Encoder::new(w_buf, new_w, new_h);
    encoder.set_color(ColorType::Rgba); // 元画像に合わせて調整が必要な場合があります
    encoder.set_depth(BitDepth::Eight);

    // 元のDPI情報があればセットする
    if pixel_dims.is_some() {
    encoder.set_pixel_dims(pixel_dims);
}

    let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
    writer.write_image_data(&subimg).map_err(|e| e.to_string())?;
    
    Ok(output_path)
}


#[tauri::command]
async fn batch_bleed_images(
    window: tauri::Window,
    input_dir: String,
    output_dir_name: String,
    convert_type: ConvertPaperType,
    bleed_amount: u32,
) -> Result<Vec<String>, String> {
    use tauri::Emitter;
    let input_path = PathBuf::from(&input_dir);
    
    // Create output directory inside the input directory
    let output_path = input_path.join(&output_dir_name);
    
    // Create output directory if it doesn't exist
    fs::create_dir_all(&output_path).map_err(|e| e.to_string())?;
    
    // Read directory
    let entries_vec: Vec<_> = fs::read_dir(&input_path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .collect();

    // Count viable files
    let mut files_to_process = Vec::new();
    for entry in &entries_vec {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "png" {
                    files_to_process.push(path);
                }
            }
        }
    }

    let total = files_to_process.len();
    let mut current = 0;
    let mut processed_files = Vec::new();
    
    for path in files_to_process {
        // Process file
        if let Some(filename) = path.file_name() {
            let output_file = output_path.join(filename);
            let input_str = path.to_string_lossy().to_string();
            let output_str = output_file.to_string_lossy().to_string();
            
            match bleed_image(input_str.clone(), output_str.clone(), convert_type.clone(), bleed_amount).await {
                Ok(_) => {
                    processed_files.push(input_str);
                },
                Err(e) => eprintln!("Failed to bleed {}: {}", input_str, e),
            }
        }
        
        current += 1;
        let _ = window.emit("bleed-progress", ProgressPayload { current, total });
    }
    
    Ok(processed_files)
}

#[tauri::command]
async fn get_thumbnail(path: String) -> Result<Vec<u8>, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    // Resize to 200x200 max, preserving aspect ratio
    // usage of thumbnail is faster than resize for downscaling
    let thumb = img.thumbnail(200, 200);
    
    let mut buffer = Vec::new();
    // Encode as JPEG with 80 quality for speed/size
    thumb.write_to(&mut std::io::Cursor::new(&mut buffer), image::ImageOutputFormat::Jpeg(80))
        .map_err(|e| e.to_string())?;
        
    Ok(buffer)
}

#[tauri::command]
async fn merge_to_pdf(window: tauri::Window, items: Vec<MergeItem>, output_dir: String) -> Result<String, String> {
    use tauri::Emitter;
    let mut content = String::from("#set page(margin: 0pt)\n");
    let total = items.len();
    let mut current = 0;
    
    // Initial progress
    let _ = window.emit("merge-progress", ProgressPayload { current, total });

    let root = PathBuf::from(&output_dir);
    for item in items {
        match item {
            MergeItem::Image(path) => {
                let abs = Path::new(&path);
                let rel = abs.strip_prefix(&root)
                    .map_err(|_| "image is outside root directory")?;

                let typst_path = rel.to_string_lossy().replace('\\', "/");

                content.push_str(&format!(
                    "#image(\"{}\", width: 100%, height: 100%)\n",
                    typst_path
                ));
            },
            MergeItem::Blank => {
                content.push_str("#pagebreak()\n");
            }
        }
        current += 1;
        let _ = window.emit("merge-progress", ProgressPayload { current, total });
    }

    let world = TypstWrapperWorld::new(output_dir.to_owned(), content, Some(window), total);
    
    // Render document
    let document = typst::compile(&world)
        .output
        .map_err(|e| format!("Typst compilation failed: {:?}", e))?;

    // Output to pdf
    let pdf = typst_pdf::pdf(&document, &PdfOptions::default())
        .map_err(|e| format!("PDF generation failed: {:?}", e))?;

    let output_path = Path::new(&output_dir).join("merged.pdf");
    fs::write(&output_path, pdf).map_err(|e| format!("Failed to write PDF: {}", e))?;
    
    println!("Created pdf: {:?}", output_path);

    Ok(output_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![greet, bleed_image, merge_to_pdf, get_thumbnail, batch_bleed_images])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_bleed_size_b5() {
        let params = get_bleed_size(ConvertPaperType::B5);
        assert_eq!(params.width, 182.0);
        assert_eq!(params.height, 257.0);
    }

    #[test]
    fn test_get_bleed_size_a5() {
        let params = get_bleed_size(ConvertPaperType::A5);
        assert_eq!(params.width, 148.0);
        assert_eq!(params.height, 210.0);
    }

    #[test]
    fn test_calculate_target_dimensions() {
        // Test case: B5 (182x257mm) with 3mm bleed at 350 DPI
        // Width: (182 + 6) * (350 / 25.4) = 188 * 13.7795... = 2590.55... -> 2591
        // Height: (257 + 6) * (350 / 25.4) = 263 * 13.7795... = 3624.01... -> 3624
        
        let (w, h) = calculate_target_dimensions(182.0, 257.0, 3.0, 350.0);
        assert_eq!(w, 2591);
        assert_eq!(h, 3624);
    }

    #[test]
    fn test_calculate_target_dimensions_no_bleed() {
        // Test case: 100x100mm, 0mm bleed, 254 DPI (10px/mm)
        // (100 + 0) * 10 = 1000
        let (w, h) = calculate_target_dimensions(100.0, 100.0, 0.0, 254.0);
        assert_eq!(w, 1000);
        assert_eq!(h, 1000);
    }
}
