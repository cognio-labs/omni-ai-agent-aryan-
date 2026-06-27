from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Color Constants (Bold Blue template)
    ELECTRIC_BLUE = RGBColor(37, 99, 235)  # #2563EB
    CYAN = RGBColor(6, 182, 212)       # #06B6D4
    WHITE = RGBColor(255, 255, 255)
    DARK_BLUE = RGBColor(30, 64, 175)   # #1E40AF
    TEXT_MUTED = RGBColor(224, 231, 255) # #E0E7FF

    def apply_slide_background(slide):
        # Full screen background
        bg = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5)
        )
        bg.fill.solid()
        bg.fill.fore_color.rgb = ELECTRIC_BLUE
        bg.line.fill.background()
        
        # Cyan bottom accent border
        accent = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(0), Inches(7.2), Inches(13.333), Inches(0.3)
        )
        accent.fill.solid()
        accent.fill.fore_color.rgb = CYAN
        accent.line.fill.background()

    # SLIDE 1: Title
    slide_layout = prs.slide_layouts[6]
    slide1 = prs.slides.add_slide(slide_layout)
    apply_slide_background(slide1)

    title_box = slide1.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(11.333), Inches(3.5))
    tf1 = title_box.text_frame
    tf1.word_wrap = True

    p = tf1.paragraphs[0]
    p.text = "DIGITAL MARKETING STRATEGY"
    p.font.name = "Poppins"
    p.font.size = Pt(54)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.LEFT

    p2 = tf1.add_paragraph()
    p2.text = "FOR SAAS STARTUPS"
    p2.font.name = "Poppins"
    p2.font.size = Pt(48)
    p2.font.bold = True
    p2.font.color.rgb = CYAN
    p2.alignment = PP_ALIGN.LEFT

    p3 = tf1.add_paragraph()
    p3.text = "Scale your audience, lower CAC, and drive sustainable growth."
    p3.font.name = "Inter"
    p3.font.size = Pt(20)
    p3.font.color.rgb = TEXT_MUTED
    p3.space_before = Pt(30)
    p3.alignment = PP_ALIGN.LEFT

    notes1 = slide1.notes_slide.notes_text_frame
    notes1.text = "Welcome to the SaaS marketing strategy kickoff. Our key focus is maximizing distribution value by designing custom acquisition engines."

    # SLIDE 2: Strategy Overview
    slide2 = prs.slides.add_slide(slide_layout)
    apply_slide_background(slide2)

    title_box2 = slide2.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(1.0))
    p = title_box2.text_frame.paragraphs[0]
    p.text = "STRATEGY OVERVIEW & AGENDA"
    p.font.name = "Poppins"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE

    cols = ["Target ICP", "SEO Engine", "Paid Channels", "Funnel CRO"]
    descs = [
        "Identify high-value user personas for sales alignment.",
        "Produce bottom-of-funnel keywords to capture target demand.",
        "Scale search campaigns and dynamic social remarketing.",
        "Optimize conversion steps and onboarding pathways."
    ]

    for i in range(4):
        left = Inches(1.0 + (i * 2.85))
        top = Inches(2.2)
        width = Inches(2.65)
        height = Inches(4.2)
        
        card = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = DARK_BLUE
        card.line.color.rgb = CYAN
        card.line.width = Pt(1.5)
        
        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.2)
        tf.margin_right = Inches(0.2)
        tf.margin_top = Inches(0.3)
        
        p = tf.paragraphs[0]
        p.text = f"0{i+1}"
        p.font.name = "Poppins"
        p.font.size = Pt(32)
        p.font.bold = True
        p.font.color.rgb = CYAN
        
        p2 = tf.add_paragraph()
        p2.text = cols[i]
        p2.font.name = "Poppins"
        p2.font.size = Pt(20)
        p2.font.bold = True
        p2.font.color.rgb = WHITE
        p2.space_before = Pt(14)
        
        p3 = tf.add_paragraph()
        p3.text = descs[i]
        p3.font.name = "Inter"
        p3.font.size = Pt(13)
        p3.font.color.rgb = TEXT_MUTED
        p3.space_before = Pt(10)

    notes2 = slide2.notes_slide.notes_text_frame
    notes2.text = "This slide outlines our agenda: Ideal Customer Profiles, Topical Search authority, Paid Acquisition, and Landing Page conversion optimizations."

    # SLIDE 3: ICP Segment
    slide3 = prs.slides.add_slide(slide_layout)
    apply_slide_background(slide3)

    title_box3 = slide3.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(1.0))
    p = title_box3.text_frame.paragraphs[0]
    p.text = "DEFINING THE SAAS TARGET AUDIENCE"
    p.font.name = "Poppins"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE

    text_box3 = slide3.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(6.0), Inches(4.5))
    tf3 = text_box3.text_frame
    tf3.word_wrap = True

    p_sub = tf3.paragraphs[0]
    p_sub.text = "Ideal Customer Profile (ICP) Criteria:"
    p_sub.font.name = "Poppins"
    p_sub.font.size = Pt(22)
    p_sub.font.bold = True
    p_sub.font.color.rgb = CYAN
    p_sub.space_after = Pt(14)

    points = [
        "Laser-Focus: Target marketing decision makers (VP Marketing, CMOs, CTOs).",
        "Company Size: B2B companies with 50-200 employees.",
        "Revenue Base: Mid-market SaaS segments between $10M-$50M ARR.",
        "Pain Points: System integrations, security, and developer productivity."
    ]

    for pt in points:
        p_pt = tf3.add_paragraph()
        p_pt.text = "• " + pt
        p_pt.font.name = "Inter"
        p_pt.font.size = Pt(15)
        p_pt.font.color.rgb = WHITE
        p_pt.space_after = Pt(10)

    sb = slide3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(7.5), Inches(2.2), Inches(4.8), Inches(4.2))
    sb.fill.solid()
    sb.fill.fore_color.rgb = DARK_BLUE
    sb.line.color.rgb = CYAN
    sb.line.width = Pt(1.5)

    tf_sb = sb.text_frame
    tf_sb.word_wrap = True
    tf_sb.margin_left = Inches(0.4)
    tf_sb.margin_top = Inches(0.4)

    p_sb_title = tf_sb.paragraphs[0]
    p_sb_title.text = "Persona Summary"
    p_sb_title.font.name = "Poppins"
    p_sb_title.font.size = Pt(20)
    p_sb_title.font.bold = True
    p_sb_title.font.color.rgb = CYAN

    p_sb_body = tf_sb.add_paragraph()
    p_sb_body.text = "Our target accounts have existing budgets but suffer from integration bottlenecks. We pitch speed-to-value as our core advantage over legacy players."
    p_sb_body.font.name = "Inter"
    p_sb_body.font.size = Pt(14)
    p_sb_body.font.color.rgb = WHITE
    p_sb_body.space_before = Pt(15)

    notes3 = slide3.notes_slide.notes_text_frame
    notes3.text = "Understanding the target audience reduces marketing wastage. We speak directly to business efficiency and developer resource optimization."

    # SLIDE 4: SEO Strategy
    slide4 = prs.slides.add_slide(slide_layout)
    apply_slide_background(slide4)

    title_box4 = slide4.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(1.0))
    p = title_box4.text_frame.paragraphs[0]
    p.text = "TOPICAL AUTHORITY & SEO STRUCTURE"
    p.font.name = "Poppins"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE

    seo_steps = ["01. Bottom-of-Funnel Focus", "02. Hub & Spoke Structure", "03. Inline CTA Capture"]
    seo_descs = [
        "Prioritize software comparison sheets and alternative pages to target transactional keyword intents.",
        "Design key resource landing hubs supported by hyper-targeted sub-articles.",
        "Integrate contextual signups and sandbox testing environments directly within the text layout."
    ]

    for i in range(3):
        left = Inches(1.0 + (i * 3.8))
        top = Inches(2.2)
        width = Inches(3.6)
        height = Inches(4.2)
        
        box = slide4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        box.fill.solid()
        box.fill.fore_color.rgb = DARK_BLUE
        box.line.color.rgb = CYAN
        box.line.width = Pt(1.5)
        
        tf = box.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.3)
        tf.margin_right = Inches(0.3)
        tf.margin_top = Inches(0.4)
        
        p = tf.paragraphs[0]
        p.text = seo_steps[i]
        p.font.name = "Poppins"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = CYAN
        
        p2 = tf.add_paragraph()
        p2.text = seo_descs[i]
        p2.font.name = "Inter"
        p2.font.size = Pt(14)
        p2.font.color.rgb = WHITE
        p2.space_before = Pt(14)

    notes4 = slide4.notes_slide.notes_text_frame
    notes4.text = "SEO compounds over time. By focusing on intent and conversion, we drive down long-term CAC."

    # SLIDE 5: Paid Channels
    slide5 = prs.slides.add_slide(slide_layout)
    apply_slide_background(slide5)

    title_box5 = slide5.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(1.0))
    p = title_box5.text_frame.paragraphs[0]
    p.text = "PAID ACQUISITION & ABM CAMPAIGNS"
    p.font.name = "Poppins"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE

    lp = slide5.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.0), Inches(2.2), Inches(5.3), Inches(4.2))
    lp.fill.solid()
    lp.fill.fore_color.rgb = DARK_BLUE
    lp.line.color.rgb = CYAN
    tf_lp = lp.text_frame
    tf_lp.word_wrap = True
    tf_lp.margin_left = Inches(0.4)
    tf_lp.margin_top = Inches(0.4)

    p = tf_lp.paragraphs[0]
    p.text = "Google Ads & Search Intent"
    p.font.name = "Poppins"
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = CYAN

    p2 = tf_lp.add_paragraph()
    p2.text = "• Target competitor term bids to capture searching prospects.\n• Send traffic to highly optimized standalone landers.\n• Capture immediate buyer intent efficiently."
    p2.font.name = "Inter"
    p2.font.size = Pt(14)
    p2.font.color.rgb = WHITE
    p2.space_before = Pt(14)

    rp = slide5.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(7.0), Inches(2.2), Inches(5.3), Inches(4.2))
    rp.fill.solid()
    rp.fill.fore_color.rgb = DARK_BLUE
    rp.line.color.rgb = CYAN
    tf_rp = rp.text_frame
    tf_rp.word_wrap = True
    tf_rp.margin_left = Inches(0.4)
    tf_rp.margin_top = Inches(0.4)

    p = tf_rp.paragraphs[0]
    p.text = "LinkedIn Account Targeting"
    p.font.name = "Poppins"
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = CYAN

    p2 = tf_rp.add_paragraph()
    p2.text = "• Upload specific target account matrices for zero-waste spend.\n• Serve case studies displaying clear economic ROI calculations.\n• Distribute highly useful, download-ready resources."
    p2.font.name = "Inter"
    p2.font.size = Pt(14)
    p2.font.color.rgb = WHITE
    p2.space_before = Pt(14)

    notes5 = slide5.notes_slide.notes_text_frame
    notes5.text = "Paid acquisition combines search intent with precise account targeting to fill the pipe with high-intent buyers."

    # SLIDE 6: Product-Led Growth
    slide6 = prs.slides.add_slide(slide_layout)
    apply_slide_background(slide6)

    title_box6 = slide6.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(1.0))
    p = title_box6.text_frame.paragraphs[0]
    p.text = "PRODUCT-LED GROWTH (PLG) LOOPS"
    p.font.name = "Poppins"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE

    plg_steps = ["Fast Aha! Moment", "Viral Referral Loops", "Value-Based Tiers"]
    plg_descs = [
        "Deliver instant platform utility without requiring lengthy signup or onboarding documentation.",
        "Encourage team invitations and joint sharing directly from workspace panels.",
        "Link pricing plans directly to feature usage bounds and workspace seat growth metrics."
    ]

    for i in range(3):
        left = Inches(1.0 + (i * 3.8))
        top = Inches(2.2)
        width = Inches(3.6)
        height = Inches(4.2)
        
        box = slide6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        box.fill.solid()
        box.fill.fore_color.rgb = DARK_BLUE
        box.line.color.rgb = CYAN
        box.line.width = Pt(1.5)
        
        tf = box.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.3)
        tf.margin_right = Inches(0.3)
        tf.margin_top = Inches(0.4)
        
        p = tf.paragraphs[0]
        p.text = plg_steps[i]
        p.font.name = "Poppins"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = CYAN
        
        p2 = tf.add_paragraph()
        p2.text = plg_descs[i]
        p2.font.name = "Inter"
        p2.font.size = Pt(14)
        p2.font.color.rgb = WHITE
        p2.space_before = Pt(14)

    notes6 = slide6.notes_slide.notes_text_frame
    notes6.text = "By shifting from sales-led to product-led loops, user sharing loops act as our secondary referral marketing strategy."

    # SLIDE 7: CRO & Funnel Conversion Rates
    slide7 = prs.slides.add_slide(slide_layout)
    apply_slide_background(slide7)

    title_box7 = slide7.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(1.0))
    p = title_box7.text_frame.paragraphs[0]
    p.text = "OPTIMIZING CONVERSION FUNNELS"
    p.font.name = "Poppins"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE

    fn = slide7.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.0), Inches(2.2), Inches(11.333), Inches(4.2))
    fn.fill.solid()
    fn.fill.fore_color.rgb = DARK_BLUE
    fn.line.color.rgb = CYAN
    tf_fn = fn.text_frame
    tf_fn.word_wrap = True
    tf_fn.margin_left = Inches(0.5)
    tf_fn.margin_top = Inches(0.5)

    p = tf_fn.paragraphs[0]
    p.text = "Strategic Conversion Optimizations:"
    p.font.name = "Poppins"
    p.font.size = Pt(22)
    p.font.bold = True
    p.font.color.rgb = CYAN

    opts = [
        "Simplifying Registration Flows: Strip out initial setup queries to lower signup friction.",
        "Interactive Demos: Add sandbox environments directly to landing page blocks.",
        "Targeted A/B Testing: Run ongoing headline, CTA, and social proof tests."
    ]

    for opt in opts:
        p_opt = tf_fn.add_paragraph()
        p_opt.text = "• " + opt
        p_opt.font.name = "Inter"
        p_opt.font.size = Pt(15)
        p_opt.font.color.rgb = WHITE
        p_opt.space_before = Pt(14)

    notes7 = slide7.notes_slide.notes_text_frame
    notes7.text = "Improving conversion rate across funnel steps has a multiplier effect on SaaS acquisition pipelines."

    # SLIDE 8: Growth Metrics Dashboard
    slide8 = prs.slides.add_slide(slide_layout)
    apply_slide_background(slide8)

    title_box8 = slide8.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(1.0))
    p = title_box8.text_frame.paragraphs[0]
    p.text = "NORTH STAR MARKETING METRICS"
    p.font.name = "Poppins"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE

    metrics = ["4.2 : 1", "112%", "2.4%"]
    labels = ["LTV TO CAC RATIO", "NET REVENUE RETENTION", "MONTHLY LOGO CHURN"]
    targets = ["Target: > 3.0 : 1", "Target: > 105%", "Target: < 3.0%"]

    for i in range(3):
        left = Inches(1.0 + (i * 3.8))
        top = Inches(2.2)
        width = Inches(3.6)
        height = Inches(4.2)
        
        card = slide8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = WHITE
        card.line.fill.background()
        
        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_top = Inches(0.6)
        
        p = tf.paragraphs[0]
        p.text = labels[i]
        p.font.name = "Inter"
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = ELECTRIC_BLUE
        p.alignment = PP_ALIGN.CENTER
        
        p2 = tf.add_paragraph()
        p2.text = metrics[i]
        p2.font.name = "Poppins"
        p2.font.size = Pt(44)
        p2.font.bold = True
        p2.font.color.rgb = DARK_BLUE
        p2.alignment = PP_ALIGN.CENTER
        p2.space_before = Pt(20)
        
        p3 = tf.add_paragraph()
        p3.text = targets[i]
        p3.font.name = "Inter"
        p3.font.size = Pt(12)
        p3.font.bold = True
        p3.font.color.rgb = CYAN
        p3.alignment = PP_ALIGN.CENTER
        p3.space_before = Pt(20)

    notes8 = slide8.notes_slide.notes_text_frame
    notes8.text = "These numbers represent the financial health of the marketing engine. High NRR and LTV-to-CAC ensure profitability."

    # SLIDE 9: Roadmap
    slide9 = prs.slides.add_slide(slide_layout)
    apply_slide_background(slide9)

    title_box9 = slide9.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(1.0))
    p = title_box9.text_frame.paragraphs[0]
    p.text = "12-MONTH GROWTH ROADMAP"
    p.font.name = "Poppins"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE

    roadmap_box = slide9.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(11.333), Inches(4.5))
    tf = roadmap_box.text_frame
    tf.word_wrap = True

    phases = ["Q1: Infrastructure Setup", "Q2: SEO & Content Launch", "Q3 & Q4: Scaling Channels"]
    details = [
        "Configure CRM/analytics systems, perform message tests, and optimize high-priority signups.",
        "Begin high-intent compare campaigns and deploy central knowledge content pages.",
        "Launch search ads, scale programmatic organic search outputs, and enable user virality points."
    ]

    for i in range(3):
        p = tf.add_paragraph()
        p.text = phases[i]
        p.font.name = "Poppins"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = CYAN
        p.space_after = Pt(4)
        if i > 0:
            p.space_before = Pt(20)
            
        p2 = tf.add_paragraph()
        p2.text = details[i]
        p2.font.name = "Inter"
        p2.font.size = Pt(14)
        p2.font.color.rgb = WHITE

    notes9 = slide9.notes_slide.notes_text_frame
    notes9.text = "Our strategic implementation path moves from tracking infrastructure setup to scaling high-intent acquisition campaigns."

    # SLIDE 10: Call to Action
    slide10 = prs.slides.add_slide(slide_layout)
    apply_slide_background(slide10)

    title_box10 = slide10.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.333), Inches(1.5))
    p = title_box10.text_frame.paragraphs[0]
    p.text = "SCALE YOUR SAAS VENTURE"
    p.font.name = "Poppins"
    p.font.size = Pt(44)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER

    p2 = title_box10.text_frame.add_paragraph()
    p2.text = "Let's align acquisition channels, build topical authority, and accelerate revenue."
    p2.font.name = "Inter"
    p2.font.size = Pt(18)
    p2.font.color.rgb = TEXT_MUTED
    p2.alignment = PP_ALIGN.CENTER
    p2.space_before = Pt(10)

    contact_box = slide10.shapes.add_textbox(Inches(3.666), Inches(3.8), Inches(6.0), Inches(2.5))
    tf_c = contact_box.text_frame
    tf_c.word_wrap = True

    contacts = [
        "Website: saasgrowth.com/consult",
        "Email: partner@saasgrowth.com",
        "Phone: 1-800-GROWTH-NOW"
    ]

    for contact in contacts:
        p_c = tf_c.add_paragraph()
        p_c.text = contact
        p_c.font.name = "Inter"
        p_c.font.size = Pt(16)
        p_c.font.color.rgb = CYAN
        p_c.alignment = PP_ALIGN.CENTER
        p_c.space_before = Pt(10)

    notes10 = slide10.notes_slide.notes_text_frame
    notes10.text = "Let's summarize the immediate next steps to kick off the execution plan and schedule the consulting call."

    prs.save('digital_marketing_strategy_presentation.pptx')

if __name__ == "__main__":
    create_presentation()
