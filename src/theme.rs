use iced::theme::Palette;
use iced::widget::container;
use iced::{Background, Border, Theme};

// Lebu color palette - A beautiful dark theme inspired by modern terminals
pub mod colors {
    use iced::Color;

    // Background colors
    pub const BG_PRIMARY: Color = Color::from_rgb(0.08, 0.08, 0.12); // Deep dark blue-black
    pub const BG_SECONDARY: Color = Color::from_rgb(0.10, 0.10, 0.15); // Slightly lighter
    pub const BG_TERTIARY: Color = Color::from_rgb(0.12, 0.12, 0.18); // For hover states

    // Text colors
    pub const TEXT_PRIMARY: Color = Color::from_rgb(0.92, 0.92, 0.95); // Almost white
    pub const TEXT_SECONDARY: Color = Color::from_rgb(0.65, 0.65, 0.72); // Muted
    pub const TEXT_MUTED: Color = Color::from_rgb(0.45, 0.45, 0.52); // Very muted

    // Accent colors
    pub const ACCENT_PRIMARY: Color = Color::from_rgb(0.55, 0.40, 0.92); // Purple
    pub const ACCENT_SECONDARY: Color = Color::from_rgb(0.30, 0.75, 0.85); // Cyan
    pub const ACCENT_SUCCESS: Color = Color::from_rgb(0.35, 0.80, 0.50); // Green
    pub const ACCENT_WARNING: Color = Color::from_rgb(0.95, 0.75, 0.30); // Yellow
    pub const ACCENT_ERROR: Color = Color::from_rgb(0.90, 0.35, 0.40); // Red

    // Border colors
    pub const BORDER_SUBTLE: Color = Color::from_rgb(0.18, 0.18, 0.25);
    pub const BORDER_ACTIVE: Color = Color::from_rgb(0.55, 0.40, 0.92);
}

/// Creates the custom Lebu theme
pub fn lebu_theme() -> Theme {
    Theme::custom(
        "Lebu".to_string(),
        Palette {
            background: colors::BG_PRIMARY,
            text: colors::TEXT_PRIMARY,
            primary: colors::ACCENT_PRIMARY,
            success: colors::ACCENT_SUCCESS,
            danger: colors::ACCENT_ERROR,
        },
    )
}

/// Terminal container style
pub fn terminal_container(_theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(colors::BG_PRIMARY)),
        border: Border {
            color: colors::BORDER_SUBTLE,
            width: 0.0,
            radius: 12.0.into(),
        },
        ..Default::default()
    }
}

/// Header bar style
pub fn header_container(_theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(colors::BG_SECONDARY)),
        border: Border {
            color: colors::BORDER_SUBTLE,
            width: 0.0,
            radius: 12.0.into(), // Use uniform radius for simplicity
        },
        ..Default::default()
    }
}

/// Content area style
pub fn content_container(_theme: &Theme) -> container::Style {
    container::Style {
        background: Some(Background::Color(colors::BG_PRIMARY)),
        border: Border {
            color: colors::BORDER_SUBTLE,
            width: 0.0,
            radius: 0.0.into(),
        },
        ..Default::default()
    }
}
