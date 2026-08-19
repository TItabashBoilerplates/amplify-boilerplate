/// フロントエンドから呼ばれるコマンド。
///
/// プラットフォーム名だけのために JS 側へ `@tauri-apps/plugin-os` を足さず、
/// Rust の標準定数を返す（依存を増やさない）。
#[tauri::command]
fn platform_label() -> String {
    std::env::consts::OS.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![platform_label])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
