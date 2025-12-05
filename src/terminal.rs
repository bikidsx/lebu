use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use vte::{Params, Parser, Perform};

/// Terminal grid cell
#[derive(Clone, Debug)]
pub struct Cell {
    pub c: char,
}

impl Default for Cell {
    fn default() -> Self {
        Self { c: ' ' }
    }
}

/// Terminal screen buffer
pub struct TerminalBuffer {
    pub cols: usize,
    pub rows: usize,
    pub grid: Vec<Vec<Cell>>,
    pub cursor_row: usize,
    pub cursor_col: usize,
}

impl TerminalBuffer {
    pub fn new(cols: usize, rows: usize) -> Self {
        Self {
            cols,
            rows,
            grid: vec![vec![Cell::default(); cols]; rows],
            cursor_row: 0,
            cursor_col: 0,
        }
    }

    pub fn print(&mut self, c: char) {
        if self.cursor_col >= self.cols {
            self.cursor_col = 0;
            self.newline();
        }
        if self.cursor_row < self.rows && self.cursor_col < self.cols {
            self.grid[self.cursor_row][self.cursor_col].c = c;
            self.cursor_col += 1;
        }
    }

    pub fn newline(&mut self) {
        self.cursor_col = 0;
        if self.cursor_row + 1 >= self.rows {
            // Scroll up
            self.grid.remove(0);
            self.grid.push(vec![Cell::default(); self.cols]);
        } else {
            self.cursor_row += 1;
        }
    }

    pub fn carriage_return(&mut self) {
        self.cursor_col = 0;
    }

    pub fn backspace(&mut self) {
        if self.cursor_col > 0 {
            self.cursor_col -= 1;
        }
    }

    pub fn erase_in_line(&mut self, mode: u16) {
        match mode {
            0 => {
                // Erase from cursor to end of line
                for col in self.cursor_col..self.cols {
                    self.grid[self.cursor_row][col] = Cell::default();
                }
            }
            1 => {
                // Erase from start of line to cursor
                for col in 0..=self.cursor_col.min(self.cols - 1) {
                    self.grid[self.cursor_row][col] = Cell::default();
                }
            }
            2 => {
                // Erase entire line
                for col in 0..self.cols {
                    self.grid[self.cursor_row][col] = Cell::default();
                }
            }
            _ => {}
        }
    }

    pub fn erase_in_display(&mut self, mode: u16) {
        match mode {
            0 => {
                // Erase from cursor to end of screen
                self.erase_in_line(0);
                for row in (self.cursor_row + 1)..self.rows {
                    for col in 0..self.cols {
                        self.grid[row][col] = Cell::default();
                    }
                }
            }
            1 => {
                // Erase from start of screen to cursor
                for row in 0..self.cursor_row {
                    for col in 0..self.cols {
                        self.grid[row][col] = Cell::default();
                    }
                }
                self.erase_in_line(1);
            }
            2 | 3 => {
                // Erase entire screen
                for row in 0..self.rows {
                    for col in 0..self.cols {
                        self.grid[row][col] = Cell::default();
                    }
                }
                self.cursor_row = 0;
                self.cursor_col = 0;
            }
            _ => {}
        }
    }

    pub fn cursor_up(&mut self, n: usize) {
        self.cursor_row = self.cursor_row.saturating_sub(n);
    }

    pub fn cursor_down(&mut self, n: usize) {
        self.cursor_row = (self.cursor_row + n).min(self.rows - 1);
    }

    pub fn cursor_forward(&mut self, n: usize) {
        self.cursor_col = (self.cursor_col + n).min(self.cols - 1);
    }

    pub fn cursor_back(&mut self, n: usize) {
        self.cursor_col = self.cursor_col.saturating_sub(n);
    }

    pub fn set_cursor_pos(&mut self, row: usize, col: usize) {
        self.cursor_row = row.saturating_sub(1).min(self.rows - 1);
        self.cursor_col = col.saturating_sub(1).min(self.cols - 1);
    }

    pub fn to_string(&self) -> String {
        let mut result = String::new();
        for row in &self.grid {
            let line: String = row.iter().map(|c| c.c).collect();
            result.push_str(line.trim_end());
            result.push('\n');
        }
        // Remove trailing empty lines
        while result.ends_with("\n\n") {
            result.pop();
        }
        result
    }
}

/// VTE Performer that updates the terminal buffer
struct TerminalPerformer {
    buffer: Arc<Mutex<TerminalBuffer>>,
}

impl Perform for TerminalPerformer {
    fn print(&mut self, c: char) {
        if let Ok(mut buf) = self.buffer.lock() {
            buf.print(c);
        }
    }

    fn execute(&mut self, byte: u8) {
        if let Ok(mut buf) = self.buffer.lock() {
            match byte {
                0x08 => buf.backspace(), // BS
                0x09 => {
                    // HT (Tab)
                    let next_tab = (buf.cursor_col / 8 + 1) * 8;
                    buf.cursor_col = next_tab.min(buf.cols - 1);
                }
                0x0A | 0x0B | 0x0C => buf.newline(), // LF, VT, FF
                0x0D => buf.carriage_return(),       // CR
                0x7F => buf.backspace(),             // DEL
                _ => {}
            }
        }
    }

    fn csi_dispatch(
        &mut self,
        params: &Params,
        _intermediates: &[u8],
        _ignore: bool,
        action: char,
    ) {
        if let Ok(mut buf) = self.buffer.lock() {
            let mut param_iter = params.iter();
            let first = param_iter
                .next()
                .and_then(|p| p.first().copied())
                .unwrap_or(0);
            let second = param_iter
                .next()
                .and_then(|p| p.first().copied())
                .unwrap_or(0);

            match action {
                'A' => buf.cursor_up(first.max(1) as usize),
                'B' => buf.cursor_down(first.max(1) as usize),
                'C' => buf.cursor_forward(first.max(1) as usize),
                'D' => buf.cursor_back(first.max(1) as usize),
                'H' | 'f' => buf.set_cursor_pos(first as usize, second as usize),
                'J' => buf.erase_in_display(first),
                'K' => buf.erase_in_line(first),
                'm' => {} // SGR (colors/styles) - ignore for now
                _ => {}
            }
        }
    }

    fn hook(&mut self, _params: &Params, _intermediates: &[u8], _ignore: bool, _c: char) {}
    fn put(&mut self, _byte: u8) {}
    fn unhook(&mut self) {}
    fn osc_dispatch(&mut self, _params: &[&[u8]], _bell_terminated: bool) {}
    fn esc_dispatch(&mut self, _intermediates: &[u8], _ignore: bool, _byte: u8) {}
}

pub struct Terminal {
    pub buffer: Arc<Mutex<TerminalBuffer>>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

impl Terminal {
    pub fn new() -> Self {
        let cols = 120;
        let rows = 40;

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows as u16,
                cols: cols as u16,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("Failed to create PTY");

        // Use zsh if available, otherwise bash
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let cmd = CommandBuilder::new(&shell);
        let _child = pair
            .slave
            .spawn_command(cmd)
            .expect("Failed to spawn shell");

        let mut reader = pair
            .master
            .try_clone_reader()
            .expect("Failed to clone reader");
        let writer = pair.master.take_writer().expect("Failed to take writer");

        let buffer = Arc::new(Mutex::new(TerminalBuffer::new(cols, rows)));
        let buffer_clone = buffer.clone();

        std::thread::spawn(move || {
            let mut parser = Parser::new();
            let mut performer = TerminalPerformer {
                buffer: buffer_clone,
            };
            let mut buf = [0u8; 4096];

            loop {
                match reader.read(&mut buf) {
                    Ok(n) if n > 0 => {
                        parser.advance(&mut performer, &buf[..n]);
                    }
                    Ok(_) => break,
                    Err(_) => break,
                }
            }
        });

        Self {
            buffer,
            writer: Arc::new(Mutex::new(writer)),
        }
    }

    pub fn get_output(&self) -> String {
        self.buffer.lock().unwrap().to_string()
    }

    pub fn write_input(&mut self, input: &str) {
        if let Ok(mut writer) = self.writer.lock() {
            let _ = write!(writer, "{}", input);
            let _ = writer.flush();
        }
    }
}
