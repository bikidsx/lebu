use iced::widget::{column, container, scrollable, text};
use iced::{Element, Font, Length, Padding};

use crate::terminal::Terminal;
use crate::theme::{self, colors};

pub fn view(terminal: &Terminal) -> Element<'static, ()> {
    let output = terminal.get_output();

    // Terminal content - clean, no fake header
    let terminal_content = container(
        scrollable(
            container(
                text(output)
                    .font(Font::with_name("JetBrainsMono Nerd Font"))
                    .size(14)
                    .color(colors::TEXT_PRIMARY),
            )
            .padding(Padding::from([16, 20])),
        )
        .height(Length::Fill)
        .width(Length::Fill),
    )
    .style(theme::terminal_container)
    .width(Length::Fill)
    .height(Length::Fill);

    // Simple outer container with background
    container(terminal_content)
        .padding(0)
        .width(Length::Fill)
        .height(Length::Fill)
        .style(|_| container::Style {
            background: Some(iced::Background::Color(colors::BG_PRIMARY)),
            ..Default::default()
        })
        .into()
}
