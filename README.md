# Comicker

Comicker is a cross-platform desktop application designed for amateur doujinshi creators. It simplifies the process of preparing digital comics for print and distribution by offering tools for Tombow cropping (trim marks) and batch PDF conversion.

## Features

- **Crop**: Automatically or manually crop images based on Tombow (trim marks) specifications.
- **Merge**: Batch convert multiple images into a single, high-quality PDF file.
- **Preview**: View and verify the final output before exporting.

## Tech Stack

This project is built with a modern, high-performance stack:

- **Core**: [Tauri](https://tauri.app/) (Rust)
- **Frontend**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **Build Tool**: [Vite](https://vitejs.dev/)

## Development

### Prerequisites

- Node.js (Latest LTS recommended)
- pnpm
- Rust & Cargo (for Tauri)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/rorikoron/Comicker.git
   cd Comicker
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run the development server:
   ```bash
   pnpm tauri dev
   ```

### Build

To build the application for production:

```bash
pnpm tauri build
```

## Contact

- **Twitter**: [@rorikoron__game](https://x.com/rorikoron__game)
- **Email**: [rorikoron@gmail.com](mailto:rorikoron@gmail.com)
