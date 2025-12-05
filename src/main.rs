mod terminal;
mod theme;
mod view;

use iced::time;
use iced::window;
use iced::{Element, Font, Size, Subscription, Task, Theme, event, keyboard};
use std::time::Duration;
use terminal::Terminal;

// Custom font bytes - Using Nerd Font for icon support
const JETBRAINS_MONO: &[u8] = include_bytes!("../assets/fonts/JetBrainsMonoNerdFont-Regular.ttf");
const JETBRAINS_MONO_BOLD: &[u8] = include_bytes!("../assets/fonts/JetBrainsMonoNerdFont-Bold.ttf");

pub fn main() -> iced::Result {
    iced::application("Lebu", TerminalApp::update, TerminalApp::view)
        .theme(TerminalApp::theme)
        .subscription(TerminalApp::subscription)
        .window(window::Settings {
            size: Size::new(900.0, 600.0),
            min_size: Some(Size::new(400.0, 300.0)),
            ..Default::default()
        })
        .font(JETBRAINS_MONO)
        .font(JETBRAINS_MONO_BOLD)
        .default_font(Font::with_name("JetBrainsMono Nerd Font"))
        .antialiasing(true)
        .run()
}

struct TerminalApp {
    terminal: Terminal,
}

#[derive(Debug, Clone)]
enum Message {
    Tick,
    Event(iced::Event),
}

impl Default for TerminalApp {
    fn default() -> Self {
        Self {
            terminal: Terminal::new(),
        }
    }
}

impl TerminalApp {
    fn update(&mut self, message: Message) -> Task<Message> {
        match message {
            Message::Tick => Task::none(),
            Message::Event(event) => {
                if let iced::Event::Keyboard(keyboard::Event::KeyPressed { key, text, .. }) = event
                {
                    match text {
                        Some(t) => self.terminal.write_input(&t.to_string()),
                        None => match key {
                            keyboard::Key::Named(keyboard::key::Named::Enter) => {
                                self.terminal.write_input("\n")
                            }
                            keyboard::Key::Named(keyboard::key::Named::Backspace) => {
                                self.terminal.write_input("\x7f") // DEL character works better with modern shells
                            }
                            keyboard::Key::Named(keyboard::key::Named::Tab) => {
                                self.terminal.write_input("\t")
                            }
                            keyboard::Key::Named(keyboard::key::Named::Escape) => {
                                self.terminal.write_input("\x1b")
                            }
                            keyboard::Key::Named(keyboard::key::Named::ArrowUp) => {
                                self.terminal.write_input("\x1b[A")
                            }
                            keyboard::Key::Named(keyboard::key::Named::ArrowDown) => {
                                self.terminal.write_input("\x1b[B")
                            }
                            keyboard::Key::Named(keyboard::key::Named::ArrowRight) => {
                                self.terminal.write_input("\x1b[C")
                            }
                            keyboard::Key::Named(keyboard::key::Named::ArrowLeft) => {
                                self.terminal.write_input("\x1b[D")
                            }
                            _ => {}
                        },
                    }
                }
                Task::none()
            }
        }
    }

    fn view(&self) -> Element<'_, Message> {
        view::view(&self.terminal).map(|_| Message::Tick)
    }

    fn subscription(&self) -> Subscription<Message> {
        Subscription::batch(vec![
            time::every(Duration::from_millis(50)).map(|_| Message::Tick),
            event::listen().map(Message::Event),
        ])
    }

    fn theme(&self) -> Theme {
        theme::lebu_theme()
    }
}
