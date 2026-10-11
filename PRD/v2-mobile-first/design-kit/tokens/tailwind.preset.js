/** Keeplas: Tailwind preset (web and NativeWind on Expo). */
module.exports = {
  theme: {
    extend: {
      colors: {
        "navy": {
                "950": "#071A30",
                "900": "#0E2340",
                "800": "#102844",
                "700": "#1E3B5E",
                "600": "#2F567F",
                "500": "#4B6E95",
                "400": "#7493B3",
                "300": "#9DBAD6",
                "200": "#C5D7E8",
                "100": "#DCE8F2",
                "50": "#EEF5FA"
        },
        "sky": {
                "600": "#1B76AE",
                "500": "#238BCA",
                "100": "#E1F1FA"
        },
        "ivory": {
                "50": "#FDFBF7",
                "100": "#F7F4EE",
                "200": "#EFE9E0"
        },
        "sand": {
                "100": "#F6EFE9",
                "200": "#EADCCD"
        },
        "dawn": {
                "100": "#FDEFD4",
                "300": "#F9DDB4",
                "500": "#F2B866"
        },
        "success": {
                "600": "#2E8B6A",
                "100": "#E3F3EC"
        },
        "warning": {
                "600": "#B87503",
                "500": "#F2A20C",
                "100": "#FEF3DC"
        },
        "danger": {
                "600": "#D92D35",
                "100": "#FDE8E8"
        },
        "category": {
                "document": "#238BCA",
                "account": "#6E56CF",
                "instruction": "#D92D35",
                "other": "#1E8A8A",
                "voice": "#D92D35",
                "note": "#F07F22",
                "video": "#1E3B5E",
                "photo": "#238BCA",
                "inbox": "#2F67C8"
        }
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'display': ['36px', { lineHeight: '40px', letterSpacing: '-0.5px', fontWeight: '600' }],
        'h1': ['30px', { lineHeight: '34px', letterSpacing: '-0.4px', fontWeight: '600' }],
        'h2': ['24px', { lineHeight: '30px', letterSpacing: '-0.2px', fontWeight: '600' }],
        'h3': ['19px', { lineHeight: '24px', letterSpacing: '0px', fontWeight: '600' }],
        'body-lg': ['17px', { lineHeight: '25px', letterSpacing: '0px', fontWeight: '400' }],
        'body': ['15px', { lineHeight: '22px', letterSpacing: '0px', fontWeight: '400' }],
        'label': ['15px', { lineHeight: '20px', letterSpacing: '0px', fontWeight: '600' }],
        'body-sm': ['13px', { lineHeight: '18px', letterSpacing: '0px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '16px', letterSpacing: '0.1px', fontWeight: '500' }],
        'code': ['34px', { lineHeight: '40px', letterSpacing: '4px', fontWeight: '600' }],
      },
      borderRadius: {'xs': '6px', 'sm': '10px', 'md': '14px', 'lg': '20px', 'xl': '28px', 'pill': '999px'},
      boxShadow: {'card': '0 1px 2px rgba(14,35,64,.05), 0 6px 18px rgba(14,35,64,.06)', 'raised': '0 2px 6px rgba(14,35,64,.08), 0 14px 32px rgba(14,35,64,.10)', 'fab': '0 6px 16px rgba(16,40,68,.35)', 'focus': '0 0 0 3px rgba(35,139,202,.35)'},
    },
  },
};
