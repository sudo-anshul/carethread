import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, FileText, FolderOpen, HeartHandshake, Link2, LockKeyhole, Menu, MessageCircle, ShieldCheck, Sparkles, X } from 'lucide-react';
import './landing.css';

interface LandingPageProps {
  onOpenWorkspace: () => void;
  onTryDemo: () => void;
  hasEpisode: boolean;
  loading: boolean;
}

const steps = [
  { title: 'Bring the pieces.', text: 'Add your test orders and reports. Start with what you have — you can always add more later.', label: 'Your documents, together' },
  { title: 'See what connects.', text: 'Check each suggested connection beside its original source. You decide which report belongs with which order.', label: 'A connection you can check' },
  { title: 'Know what to ask.', text: 'Turn the gaps and questions into a simple, editable sheet to take to your next clinic conversation.', label: 'Ready for your next conversation' },
];

function Wordmark() {
  return <span className="lp-wordmark"><span className="lp-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M8 6h7a6 6 0 0 1 0 12h-1a4 4 0 0 0 0 8h10M24 6h-2M8 14H6m18 4h2M8 26H6" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" /></svg></span>CareThread<span className="lp-brand-dot">.</span></span>;
}

function WalkthroughVisual({ active }: { active: number }) {
  return <div className={`lp-walkthrough-visual lp-scene-${active}`} aria-hidden="true">
    <div className="lp-example-bar"><span><span className="lp-small-dot" /> Your clinic visit</span><span>Illustrative example</span></div>
    <div className="lp-demo-canvas">
      <svg className="lp-connecting-thread" viewBox="0 0 520 440" fill="none"><path className="lp-thread-track" d="M165 98C340 98 185 335 386 335" /><path className="lp-thread-fill" d="M165 98C340 98 185 335 386 335" pathLength="1" /></svg>
      <div className="lp-paper lp-paper-order"><div className="lp-paper-top"><span className="lp-document-symbol"><FileText size={19} /></span><span>Test order</span><span className="lp-paper-type">01</span></div><div className="lp-paper-rule" /><strong>Your requested tests</strong><div className="lp-paper-line"><span className="lp-check-square" /> Blood count</div><div className="lp-paper-line"><span className="lp-check-square" /> Metabolic panel</div><div className="lp-paper-line"><span className="lp-check-square" /> Culture</div><span className="lp-paper-note">Keep the original close.</span></div>
      <div className="lp-paper lp-paper-report"><div className="lp-paper-top"><span className="lp-document-symbol lp-symbol-accent"><FileText size={19} /></span><span>Lab report</span><span className="lp-paper-type">02</span></div><div className="lp-paper-rule" /><strong>Blood count</strong><div className="lp-report-line" /><div className="lp-report-line short" /><div className="lp-report-source"><Link2 size={14} /><span>Check against your order</span></div></div>
      <span className="lp-link-confirmation"><Check size={15} /> Connection checked by you</span>
      <div className="lp-paper lp-paper-questions"><div className="lp-paper-top"><span className="lp-document-symbol lp-symbol-accent"><MessageCircle size={19} /></span><span>For my next visit</span></div><div className="lp-paper-rule" /><h3>My questions<br />for the clinic</h3><div className="lp-written-question"><span>1</span><p>Where can I get the report for my Culture order?</p></div><div className="lp-written-question"><span>2</span><p>My report says “partial”. Is there another report I should obtain?</p></div><div className="lp-sheet-signoff"><span className="lp-small-dot" /> Your wording. Your next conversation.</div></div>
    </div>
    <div className="lp-visual-caption"><span>{steps[active].label}</span><span className="lp-pagination">{steps.map((_, i) => <span key={i} className={active === i ? 'current' : ''} />)}</span></div>
  </div>;
}

export default function LandingPage({ onOpenWorkspace, onTryDemo, hasEpisode, loading }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const stepsRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const nodes = root.current?.querySelectorAll<HTMLElement>('[data-landing-reveal]');
    const animations: Animation[] = [];
    if (!media.matches && nodes && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const animation = entry.target.animate([{ opacity: .3, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 700, easing: 'cubic-bezier(.2,.7,.2,1)' });
          animations.push(animation); observer.unobserve(entry.target);
        });
      }, { threshold: .12 });
      nodes.forEach(node => observer.observe(node));
      const cancel = () => { if (media.matches) { observer.disconnect(); animations.forEach(animation => animation.cancel()); } };
      media.addEventListener('change', cancel);
      return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); media.removeEventListener('change', cancel); };
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 861px) and (prefers-reduced-motion: no-preference)');
    let observer: IntersectionObserver | undefined;
    const update = () => {
      observer?.disconnect();
      if (!media.matches || !stepsRef.current || !('IntersectionObserver' in window)) return;
      observer = new IntersectionObserver(entries => {
        const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveStep(Number((visible.target as HTMLElement).dataset.step));
      }, { rootMargin: '-28% 0px -37% 0px', threshold: [0, .2, .6] });
      stepsRef.current.querySelectorAll('[data-step]').forEach(element => observer!.observe(element));
    };
    update(); media.addEventListener('change', update);
    return () => { observer?.disconnect(); media.removeEventListener('change', update); };
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const navigation = <><a href="#how-it-works" onClick={closeMenu}>How it works</a><a href="#why-carethread" onClick={closeMenu}>Why CareThread</a><a href="#your-privacy" onClick={closeMenu}>Your privacy</a></>;
  const openLabel = hasEpisode ? 'Continue my workspace' : 'Get started';

  return <div className="landing-page" ref={root}>
    <a className="lp-skip" href="#landing-main">Skip to content</a>
    <header className="lp-header" onKeyDown={event => { if (event.key === 'Escape' && menuOpen) { closeMenu(); menuButton.current?.focus(); } }}><div className="lp-header-inner"><a href="/" className="lp-brand-link" aria-label="CareThread home"><Wordmark /></a><nav className="lp-desktop-nav" aria-label="Main navigation">{navigation}</nav><div className="lp-header-actions"><button className="lp-header-cta" onClick={onOpenWorkspace} disabled={loading}>{hasEpisode ? 'Continue workspace' : 'Open workspace'}<ArrowUpRight size={17} /></button><button ref={menuButton} className="lp-menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="landing-mobile-nav" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div></div><nav id="landing-mobile-nav" aria-label="Mobile navigation" className="lp-mobile-nav" hidden={!menuOpen} onKeyDown={event => { if (event.key === 'Escape') { closeMenu(); menuButton.current?.focus(); } }}>{navigation}</nav></header>

    <main id="landing-main" tabIndex={-1}>
      <section className="lp-hero lp-container" aria-labelledby="landing-title">
        <div className="lp-hero-copy"><p className="lp-intro"><span /> A little clarity for your next appointment</p><h1 id="landing-title">Your health<br />{' '}paperwork.<br />A clearer next step.</h1><p className="lp-hero-description">Bring your test orders and reports together. See what connects, then prepare a question sheet for your next conversation with your clinic.</p><div className="lp-hero-actions"><button className="lp-button lp-button-primary" onClick={onOpenWorkspace} disabled={loading}>{openLabel}<ArrowUpRight size={19} /></button><a className="lp-text-link" href="#how-it-works">See how it works<span className="lp-down-circle"><ArrowDown size={15} /></span></a></div><div className="lp-hero-reassurance"><ShieldCheck size={17} /><span>No account needed. Your documents stay with you.</span></div></div>
        <div className="lp-hero-media" data-landing-reveal><div className="lp-photo-frame"><picture><source type="image/webp" srcSet="/images/consultation-640.webp 640w, /images/consultation-960.webp 960w, /images/consultation-1440.webp 1440w" sizes="(max-width: 680px) calc(100vw - 40px), (max-width: 1000px) 46vw, 560px" /><img src="/images/consultation-960.jpg" width="960" height="1097" alt="A clinician and an adult patient looking over a paper report together." fetchPriority="high" /></picture></div><div className="lp-hero-note"><span className="lp-note-icon"><MessageCircle size={23} strokeWidth={1.6} /></span><div><span>For the conversation that matters.</span><strong>Your paperwork, together.<br />Your questions, ready.</strong></div><svg className="lp-note-thread" viewBox="0 0 80 80" aria-hidden="true"><path d="M9 13h25c30 0 30 35 0 35h-7c-23 0-23 24 0 24h39" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></div><span className="lp-photo-caption">Care starts with a conversation.</span></div>
      </section>

      <section className="lp-bridge lp-container" aria-label="What CareThread brings together"><p>Less searching for paperwork.<br /><strong>More space for your questions.</strong></p><div className="lp-bridge-items"><span><FileText size={19} />Test orders</span><span className="lp-bridge-connector" aria-hidden="true" /><span><FolderOpen size={19} />Lab reports</span><span className="lp-bridge-connector" aria-hidden="true" /><span><MessageCircle size={19} />Your questions</span></div></section>

      <section id="how-it-works" className="lp-how lp-container" aria-labelledby="lp-how-title"><div className="lp-section-heading"><div><span className="lp-section-label">How it works</span><h2 id="lp-how-title">From a stack of papers<br />to a clearer conversation.</h2></div><p>One simple place to organize what you have,<br className="lp-desktop-break" /> understand the connections, and prepare your questions.</p></div><div className="lp-how-layout"><ol className="lp-steps" ref={stepsRef}>{steps.map((step, index) => <li key={step.title} data-step={index}><button className={`lp-step ${activeStep === index ? 'is-active' : ''}`} aria-pressed={activeStep === index} onClick={() => setActiveStep(index)}><span className="lp-step-number">0{index + 1}</span><span className="lp-step-copy"><strong>{step.title}</strong><span>{step.text}</span></span><ArrowUpRight className="lp-step-arrow" size={20} /></button></li>)}</ol><div className="lp-walkthrough-sticky"><WalkthroughVisual active={activeStep} /><div className="lp-demo-invitation"><span>Curious? Take a look around with fictional documents.</span><button className="lp-text-link" onClick={hasEpisode ? onOpenWorkspace : onTryDemo} disabled={loading}>{hasEpisode ? 'Continue my workspace' : 'Explore a sample'}<ArrowRight size={16} /></button></div></div></div></section>

      <section id="why-carethread" className="lp-why" aria-labelledby="lp-why-title"><div className="lp-container lp-why-layout"><div className="lp-why-intro"><span className="lp-section-label">Made for your next visit</span><h2 id="lp-why-title">You don’t have to<br />keep it all in your head.</h2><p>CareThread helps with the paperwork around care, so you can bring your attention back to the conversation.</p><div className="lp-quiet-illustration" aria-hidden="true"><HeartHandshake size={52} strokeWidth={1} /><svg viewBox="0 0 160 55"><path d="M0 25h45c35 0 35-20 55-20s-10 43 15 43 15-23 45-23" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg></div></div><div className="lp-benefits"><article><span className="lp-benefit-icon"><FolderOpen size={23} strokeWidth={1.5} /></span><div><h3>One place for the pieces</h3><p>Your orders, reports and notes, together for one visit or period of care. Add something new whenever it arrives.</p></div></article><article><span className="lp-benefit-icon"><Link2 size={23} strokeWidth={1.5} /></span><div><h3>The source stays in sight</h3><p>Every suggested connection has information you can check. Uncertainty stays visible, including reports marked “partial”.</p></div></article><article><span className="lp-benefit-icon"><MessageCircle size={23} strokeWidth={1.5} /></span><div><h3>Your questions, in your words</h3><p>Edit a draft, choose what matters, and download a question sheet to bring to your clinic.</p></div></article></div></div></section>

      <section id="your-privacy" className="lp-privacy lp-container" aria-labelledby="lp-privacy-title" data-landing-reveal><div className="lp-privacy-emblem" aria-hidden="true"><span><LockKeyhole size={40} strokeWidth={1.25} /></span><svg viewBox="0 0 200 190"><path d="M4 25h64c65 0 65 83 0 83H45c-49 0-49 64 0 64h142" fill="none" stroke="currentColor" strokeWidth="1" /></svg></div><div className="lp-privacy-copy"><span className="lp-section-label">Personal documents. Personal control.</span><h2 id="lp-privacy-title">Your paperwork stays yours.</h2><p>Your documents are saved in your browser, on this device. You choose what to download and share. There’s no account to create and no upload to a document server.</p><div className="lp-privacy-notes"><span><Check size={15} /> No account required</span><span><Check size={15} /> Stored on your device</span><span><Check size={15} /> Clear it when you choose</span></div></div></section>

      <section className="lp-questions lp-container" aria-labelledby="lp-questions-title"><div><span className="lp-section-label">A few things to know</span><h2 id="lp-questions-title">Start where you are.</h2><p>You don’t need a perfect set of paperwork<br className="lp-desktop-break" /> to take the first step.</p></div><div className="lp-faq"><details><summary>Can I start without a test order?<ChevronDown size={20} /></summary><p>Yes. Add what you remember as a note, or keep your reports together while you ask your clinic for the original order. CareThread clearly separates your notes from source documents.</p></details><details><summary>Will CareThread tell me what my results mean?<ChevronDown size={20} /></summary><p>CareThread organizes documents and helps you prepare questions. It does not interpret medical results or confirm that care is complete. Your clinic is the right place to discuss what a result means for you.</p></details><details><summary>What kinds of documents can I add?<ChevronDown size={20} /></summary><p>Add PDFs with selectable text, plain text, or paste the original wording. Photos and scans can be kept as references, with details entered manually. Keep your original files somewhere safe too.</p></details><details><summary>Will my documents be here when I come back?<ChevronDown size={20} /></summary><p>Use the same browser, device and website address to reopen your saved workspace. Clearing browser data can remove it. There’s no cloud backup in this prototype, so keep your originals and download any question sheets you want to keep.</p></details></div></section>

      <section className="lp-final lp-container"><span className="lp-final-symbol" aria-hidden="true"><Sparkles size={24} strokeWidth={1.4} /></span><h2>Your next conversation<br />can start a little clearer.</h2><p>Bring what you have. We’ll help you put the pieces together.</p><button className="lp-button lp-button-primary" onClick={onOpenWorkspace} disabled={loading}>{openLabel}<ArrowUpRight size={19} /></button><span className="lp-prototype-note">Explore this working prototype with fictional documents.</span></section>
    </main>

    <footer className="lp-footer"><div className="lp-container"><div className="lp-footer-top"><a className="lp-brand-link" href="/" aria-label="CareThread home"><Wordmark /></a><span>A clearer next step, together.</span><a className="lp-back-top" href="#landing-main">Back to top<ArrowUpRight size={16} /></a></div><div className="lp-footer-bottom"><span>CareThread · Document organization for your next clinic conversation.</span><a href="https://www.pexels.com/photo/a-medical-practitioner-showing-a-patient-paper-7578808/" target="_blank" rel="noreferrer">Photography by cottonbro studio / Pexels<ArrowUpRight size={12} /></a></div></div></footer>
  </div>;
}
