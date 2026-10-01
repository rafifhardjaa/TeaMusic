# DESIGN SYSTEM SPECIFICATIONS

## Typography Implementation @import url('[https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Kalam:wght@400;700&amp;family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap](https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Kalam:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap)');

 .font-sans { font-family: 'Inter', sans-serif; } 

.font-serif { font-family: 'Playfair Display', serif; } .font-handwriting { font-family: 'Kalam', cursive; } .font-mono { font-family: 'JetBrains Mono', monospace; }

 ## Component Guidelines

1. Cards: Background #FFFFFF, Border 1px solid #E5E2DC, rounded-2xl.
2. Buttons (Primary): Background #2D2B2A, Text #FFFFFF, hover transitions to slightly lighter charcoal.
3. Buttons (Secondary): Background transparent, Border 1px solid #E5E2DC, Text #2D2B2A, hover border #D97757.
4. Inputs: Borderless appearance with subtle bottom border or fully contained in thin border containers. Focus state outlines should be minimal.

 

5. Micro-copy/Metadata: Use `.font-mono`, `text-[10px]`, `uppercase`, and `tracking-widest` in a muted color (#5C5A59) for timestamps, tags, and system feedback.