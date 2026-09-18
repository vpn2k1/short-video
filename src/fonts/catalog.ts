/**
 * Danh mục font cho phụ đề và văn bản. Dữ liệu thuần, không dùng API Remotion, để server, trình chỉnh sửa
 * và trang 🔤 Phụ đề cùng đọc được.
 *
 * - Font hệ thống (5 khoá đầu): có sẵn trên máy, không cần tải. Mỗi hệ điều hành vẽ hơi khác nhau.
 * - Font đóng gói: file woff2 trong public/fonts/<id>/, lấy từ Google Fonts qua Fontsource (SIL OFL 1.1, LICENSE
 *   nằm cạnh file). Chỉ giữ bộ latin + latin-ext + vietnamese, chia theo unicode-range. Chạy được khi không có mạng.
 *   Khi dựng video thì nạp bằng src/fonts/load.ts, còn trang web nạp bằng public/fonts/fonts.css.
 *
 * Thêm font: chép woff2 vào public/fonts/<id>/, thêm một mục ở đây và một dòng @font-face vào fonts.css.
 * Nhớ thử các chữ "ĐỪNG THƯỜNG ƯU ƠN NHỮNG" có dấu và in hoa.
 */

export type FontFaceFile = {
  /** Đường dẫn tính từ public/ — dùng với staticFile(). */
  file: string;
  /** "400", hoặc "100 900" nếu là font biến thiên (variable). */
  weight: string;
  unicodeRange: string;
};

export type FontInfo = {
  label: string;
  group: string;
  /** Giá trị font-family đầy đủ, kèm font dự phòng. */
  stack: string;
  /** Tên họ font khi nạp bằng FontFace. Không có nghĩa là font hệ thống. */
  family?: string;
  /** Font chỉ có một độ đậm: không cho trình duyệt tự làm đậm giả (vỡ nét), chữ giữ độ đậm gốc. */
  singleWeight?: boolean;
  faces?: FontFaceFile[];
};

export const FONT_CATALOG = {
  sans: { label: "Hệ thống", group: "Có sẵn trên máy", stack: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif' },
  rounded: { label: "Tròn (Avenir)", group: "Có sẵn trên máy", stack: '"Avenir Next", -apple-system, "Helvetica Neue", Arial, sans-serif' },
  serif: { label: "Có chân (Georgia)", group: "Có sẵn trên máy", stack: 'Georgia, "Times New Roman", serif' },
  mono: { label: "Máy chữ", group: "Có sẵn trên máy", stack: '"SF Mono", Menlo, "Courier New", monospace' },
  condensed: { label: "Hẹp (Avenir)", group: "Có sẵn trên máy", stack: '"Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif' },
  bevietnam: {
    label: "Be Vietnam Pro",
    group: "Không chân",
    stack: '"Be Vietnam Pro", sans-serif',
    family: "Be Vietnam Pro",
    faces: [
      { file: "fonts/bevietnam/be-vietnam-pro-vietnamese-500-normal.woff2", weight: "500", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-ext-500-normal.woff2", weight: "500", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-500-normal.woff2", weight: "500", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
      { file: "fonts/bevietnam/be-vietnam-pro-vietnamese-400-normal.woff2", weight: "400", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-ext-400-normal.woff2", weight: "400", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-400-normal.woff2", weight: "400", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
      { file: "fonts/bevietnam/be-vietnam-pro-vietnamese-600-normal.woff2", weight: "600", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-ext-600-normal.woff2", weight: "600", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-600-normal.woff2", weight: "600", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
      { file: "fonts/bevietnam/be-vietnam-pro-vietnamese-700-normal.woff2", weight: "700", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-ext-700-normal.woff2", weight: "700", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-700-normal.woff2", weight: "700", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
      { file: "fonts/bevietnam/be-vietnam-pro-vietnamese-800-normal.woff2", weight: "800", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-ext-800-normal.woff2", weight: "800", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-800-normal.woff2", weight: "800", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
      { file: "fonts/bevietnam/be-vietnam-pro-vietnamese-900-normal.woff2", weight: "900", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-ext-900-normal.woff2", weight: "900", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/bevietnam/be-vietnam-pro-latin-900-normal.woff2", weight: "900", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  montserrat: {
    label: "Montserrat",
    group: "Không chân",
    stack: '"Montserrat", sans-serif',
    family: "Montserrat",
    faces: [
      { file: "fonts/montserrat/montserrat-vietnamese-wght-normal.woff2", weight: "100 900", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/montserrat/montserrat-latin-ext-wght-normal.woff2", weight: "100 900", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/montserrat/montserrat-latin-wght-normal.woff2", weight: "100 900", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  roboto: {
    label: "Roboto",
    group: "Không chân",
    stack: '"Roboto", sans-serif',
    family: "Roboto",
    faces: [
      { file: "fonts/roboto/roboto-vietnamese-wght-normal.woff2", weight: "100 900", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/roboto/roboto-latin-ext-wght-normal.woff2", weight: "100 900", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/roboto/roboto-latin-wght-normal.woff2", weight: "100 900", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  lexend: {
    label: "Lexend",
    group: "Không chân",
    stack: '"Lexend", sans-serif',
    family: "Lexend",
    faces: [
      { file: "fonts/lexend/lexend-vietnamese-wght-normal.woff2", weight: "100 900", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/lexend/lexend-latin-ext-wght-normal.woff2", weight: "100 900", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/lexend/lexend-latin-wght-normal.woff2", weight: "100 900", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  nunito: {
    label: "Nunito",
    group: "Tròn",
    stack: '"Nunito", sans-serif',
    family: "Nunito",
    faces: [
      { file: "fonts/nunito/nunito-vietnamese-wght-normal.woff2", weight: "200 1000", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/nunito/nunito-latin-ext-wght-normal.woff2", weight: "200 1000", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/nunito/nunito-latin-wght-normal.woff2", weight: "200 1000", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  baloo: {
    label: "Baloo 2",
    group: "Tròn",
    stack: '"Baloo 2", sans-serif',
    family: "Baloo 2",
    faces: [
      { file: "fonts/baloo/baloo-2-vietnamese-wght-normal.woff2", weight: "400 800", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/baloo/baloo-2-latin-ext-wght-normal.woff2", weight: "400 800", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/baloo/baloo-2-latin-wght-normal.woff2", weight: "400 800", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  comfortaa: {
    label: "Comfortaa",
    group: "Tròn",
    stack: '"Comfortaa", sans-serif',
    family: "Comfortaa",
    faces: [
      { file: "fonts/comfortaa/comfortaa-vietnamese-wght-normal.woff2", weight: "300 700", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/comfortaa/comfortaa-latin-ext-wght-normal.woff2", weight: "300 700", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/comfortaa/comfortaa-latin-wght-normal.woff2", weight: "300 700", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  oswald: {
    label: "Oswald",
    group: "Hẹp & đậm",
    stack: '"Oswald", sans-serif',
    family: "Oswald",
    faces: [
      { file: "fonts/oswald/oswald-vietnamese-wght-normal.woff2", weight: "200 700", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/oswald/oswald-latin-ext-wght-normal.woff2", weight: "200 700", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/oswald/oswald-latin-wght-normal.woff2", weight: "200 700", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  anton: {
    label: "Anton",
    group: "Hẹp & đậm",
    stack: '"Anton", sans-serif',
    family: "Anton",
    singleWeight: true,
    faces: [
      { file: "fonts/anton/anton-vietnamese-400-normal.woff2", weight: "400", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/anton/anton-latin-ext-400-normal.woff2", weight: "400", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/anton/anton-latin-400-normal.woff2", weight: "400", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  bangers: {
    label: "Bangers",
    group: "Trang trí",
    stack: '"Bangers", cursive',
    family: "Bangers",
    singleWeight: true,
    faces: [
      { file: "fonts/bangers/bangers-vietnamese-400-normal.woff2", weight: "400", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/bangers/bangers-latin-ext-400-normal.woff2", weight: "400", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/bangers/bangers-latin-400-normal.woff2", weight: "400", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  bungee: {
    label: "Bungee",
    group: "Trang trí",
    stack: '"Bungee", sans-serif',
    family: "Bungee",
    singleWeight: true,
    faces: [
      { file: "fonts/bungee/bungee-vietnamese-400-normal.woff2", weight: "400", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/bungee/bungee-latin-ext-400-normal.woff2", weight: "400", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/bungee/bungee-latin-400-normal.woff2", weight: "400", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  playfair: {
    label: "Playfair Display",
    group: "Có chân",
    stack: '"Playfair Display", serif',
    family: "Playfair Display",
    faces: [
      { file: "fonts/playfair/playfair-display-vietnamese-wght-normal.woff2", weight: "400 900", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/playfair/playfair-display-latin-ext-wght-normal.woff2", weight: "400 900", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/playfair/playfair-display-latin-wght-normal.woff2", weight: "400 900", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  lora: {
    label: "Lora",
    group: "Có chân",
    stack: '"Lora", serif',
    family: "Lora",
    faces: [
      { file: "fonts/lora/lora-vietnamese-wght-normal.woff2", weight: "400 700", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/lora/lora-latin-ext-wght-normal.woff2", weight: "400 700", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/lora/lora-latin-wght-normal.woff2", weight: "400 700", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  pacifico: {
    label: "Pacifico",
    group: "Viết tay",
    stack: '"Pacifico", cursive',
    family: "Pacifico",
    singleWeight: true,
    faces: [
      { file: "fonts/pacifico/pacifico-vietnamese-400-normal.woff2", weight: "400", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/pacifico/pacifico-latin-ext-400-normal.woff2", weight: "400", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/pacifico/pacifico-latin-400-normal.woff2", weight: "400", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  dancing: {
    label: "Dancing Script",
    group: "Viết tay",
    stack: '"Dancing Script", cursive',
    family: "Dancing Script",
    faces: [
      { file: "fonts/dancing/dancing-script-vietnamese-wght-normal.woff2", weight: "400 700", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/dancing/dancing-script-latin-ext-wght-normal.woff2", weight: "400 700", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/dancing/dancing-script-latin-wght-normal.woff2", weight: "400 700", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  lobster: {
    label: "Lobster",
    group: "Viết tay",
    stack: '"Lobster", cursive',
    family: "Lobster",
    singleWeight: true,
    faces: [
      { file: "fonts/lobster/lobster-vietnamese-400-normal.woff2", weight: "400", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/lobster/lobster-latin-ext-400-normal.woff2", weight: "400", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/lobster/lobster-latin-400-normal.woff2", weight: "400", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
  patrick: {
    label: "Patrick Hand",
    group: "Viết tay",
    stack: '"Patrick Hand", cursive',
    family: "Patrick Hand",
    singleWeight: true,
    faces: [
      { file: "fonts/patrick/patrick-hand-vietnamese-400-normal.woff2", weight: "400", unicodeRange: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB" },
      { file: "fonts/patrick/patrick-hand-latin-ext-400-normal.woff2", weight: "400", unicodeRange: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
      { file: "fonts/patrick/patrick-hand-latin-400-normal.woff2", weight: "400", unicodeRange: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
    ],
  },
} satisfies Record<string, FontInfo>;

export type FontId = keyof typeof FONT_CATALOG;

/** Thứ tự hiện trong ô chọn font — nhóm theo `group`. */
export const FONT_IDS = Object.keys(FONT_CATALOG) as [FontId, ...FontId[]];

export const fontInfo = (id: string | null | undefined): FontInfo =>
  (FONT_CATALOG as Record<string, FontInfo>)[id ?? ""] ?? FONT_CATALOG.sans;

/** Nhóm font để vẽ ô chọn: [[tên nhóm, [id…]]…] theo thứ tự trong danh mục. */
export const fontGroups = (): [string, FontId[]][] => {
  const groups = new Map<string, FontId[]>();
  for (const id of FONT_IDS) {
    const group = fontInfo(id).group;
    groups.set(group, [...(groups.get(group) ?? []), id]);
  }
  return [...groups.entries()];
};
