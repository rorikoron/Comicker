// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(debug_assertions)]
fn generate_types() {
    specta::export::ts("../src/bindings.ts").expect("Failed to export types");
}

fn main() {
    #[cfg(debug_assertions)]
    generate_types();
    
    comicker_lib::run()
}
