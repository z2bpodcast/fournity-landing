'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Script from 'next/script';
import styles from './page.module.css';
import { supabase } from '../lib/supabaseClient';

const YOCO_KEY = process.env.NEXT_PUBLIC_YOCO_PUBLIC_KEY || '';
const BOOK_URL = process.env.NEXT_PUBLIC_BOOK_URL || 'https://fournity-digital.vercel.app';
const WHATSAPP_NUMBER = '27774901639';
const WHATSAPP_DISPLAY = '+27 (0)77 490 1639';
const REF_STORAGE_KEY = 'fournity_ref';

export default function Home() {
  // Referral tracking
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRef = params.get('ref');
    let code = urlRef || window.localStorage.getItem(REF_STORAGE_KEY) || '';

    if (urlRef) {
      window.localStorage.setItem(REF_STORAGE_KEY, urlRef);
      code = urlRef;
      // Log the click once per fresh referral link visit
      supabase
        .rpc('log_fournity_referral_click', {
          p_referral_code: urlRef,
          p_referrer_url: document.referrer || null,
        })
        .then(({ error }) => {
          if (error) console.error('Referral click log failed', error);
        });
    }

    if (code) setReferralCode(code);
  }, []);

  // Lead gate state
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadWhatsapp, setLeadWhatsapp] = useState('');
  const [leadErr, setLeadErr] = useState('');
  const [leadBusy, setLeadBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  // Order overlay state
  const [orderOpen, setOrderOpen] = useState(false);
  const [paymentChoiceOpen, setPaymentChoiceOpen] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successName, setSuccessName] = useState('');
  const [successRef, setSuccessRef] = useState('');

  const [order, setOrder] = useState({
    name: '',
    email: '',
    whatsapp: '',
    address: '',
    suburb: '',
    city: '',
    postal: '',
    province: '',
  });
  const [orderErr, setOrderErr] = useState('');
  const [orderBusy, setOrderBusy] = useState(false);

  function updateOrder(field, value) {
    setOrder((prev) => ({ ...prev, [field]: value }));
  }

  async function submitLead(e) {
    e.preventDefault();
    setLeadErr('');
    if (!leadName.trim()) {
      setLeadErr('Please enter your name.');
      return;
    }
    if (!leadEmail.trim() || !leadEmail.includes('@')) {
      setLeadErr('Please enter a valid email address.');
      return;
    }
    if (!leadWhatsapp.trim()) {
      setLeadErr('Please enter your WhatsApp number.');
      return;
    }
    setLeadBusy(true);
    try {
      await supabase.from('fournity_leads').insert({
        full_name: leadName.trim(),
        email: leadEmail.trim(),
        whatsapp: leadWhatsapp.trim(),
        source: 'landing_page',
        referral_code: referralCode || null,
      });
    } catch (err) {
      // Non-blocking: still let the reader through even if the insert fails
      console.error('Lead insert failed', err);
    }
    setLeadBusy(false);
    // Remember on this browser so they never see this gate again
    window.localStorage.setItem(
      'fournity_registered',
      JSON.stringify({ name: leadName.trim(), email: leadEmail.trim(), whatsapp: leadWhatsapp.trim() })
    );
    window.location.href = BOOK_URL;
  }

  function goToFreeChapters() {
    const saved = window.localStorage.getItem('fournity_registered');
    if (saved) {
      // Already registered on this browser — skip the gate entirely
      window.location.href = BOOK_URL;
    } else {
      setGateOpen(true);
    }
  }

  function openOrder() {
    setOrderOpen(true);
  }

  async function submitOrder(e) {
    e.preventDefault();
    setOrderErr('');
    const required = ['name', 'email', 'whatsapp', 'address', 'suburb', 'city', 'postal', 'province'];
    const missing = required.some((key) => !order[key].trim());
    if (missing) {
      setOrderErr('Please complete all fields.');
      return;
    }
    setOrderBusy(true);
    setOrderOpen(false);
    setPaymentChoiceOpen(true);
    setOrderBusy(false);
  }

  async function createOrderRow(paymentMethod) {
    const { data, error } = await supabase
      .from('fournity_orders')
      .insert({
        buyer_name: order.name.trim(),
        buyer_email: order.email.trim(),
        buyer_whatsapp: order.whatsapp.trim(),
        delivery_address: order.address.trim(),
        delivery_suburb: order.suburb.trim(),
        delivery_city: order.city.trim(),
        delivery_postal_code: order.postal.trim(),
        delivery_province: order.province.trim(),
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'eft' ? 'verifying' : 'pending',
        amount_paid_cents: 35000,
        is_launch_price: true,
        referral_code: referralCode || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Order insert failed', error);
      return null;
    }
    return data;
  }

  async function payWithYoco() {
    setPaymentChoiceOpen(false);
    const row = await createOrderRow('yoco');

    if (!window.YocoSDK) {
      alert(
        'Card payment is temporarily unavailable. Please use Bank Transfer / EFT, or WhatsApp Rev directly.'
      );
      return;
    }

    const yoco = new window.YocoSDK({ publicKey: YOCO_KEY });
    yoco.showPopup({
      amountInCents: 35000,
      currency: 'ZAR',
      name: 'FOURNITY — Pre-Order',
      description: 'Digital edition + Audio Reader + Workbook + Signed copy after printing',
      callback: async function (result) {
        if (result.error) {
          alert('Payment failed: ' + result.error.message);
          return;
        }
        if (row) {
          const { error: paidErr } = await supabase.rpc('mark_fournity_order_paid', {
            p_order_id: row.id,
            p_payment_reference: result.id,
          });
          if (paidErr) console.error('Marking order paid failed', paidErr);
        }
        setSuccessName(order.name);
        setSuccessRef(result.id);
        setSuccessOpen(true);
      },
    });
  }

  async function payWithEft() {
    await createOrderRow('eft');
    setShowBankDetails(true);
  }

  function confirmEftSubmitted() {
    setPaymentChoiceOpen(false);
    setShowBankDetails(false);
    setSuccessName(order.name);
    setSuccessRef('EFT — Pending Verification');
    setSuccessOpen(true);
  }

  return (
    <div className={styles.page}>
      <Script src="https://js.yoco.com/sdk/v1/yoco-sdk-web.js" strategy="afterInteractive" />

      {/* HERO */}
      <section className={styles.hero}>
        <Image
          className={styles.heroLogo}
          src="/fournity-logo.png"
          alt="FOURNITY Triquetra"
          width={150}
          height={101}
          priority
        />
        <Image
          className={styles.heroBanner}
          src="/fournity-banner.jpg"
          alt="FOURNITY — Trinity and I Are Four-nity"
          width={900}
          height={286}
          priority
        />
        <div className={styles.heroEyebrow}>By Rev Mokoro Manana</div>
        <p className={styles.heroStatement}>
          An <strong>Illumination</strong> of the revelation of the Unity of Trinity and
          Humanity — before Genesis 1:1, lost in Genesis 3, restored in Acts 2.
        </p>
        <div className={styles.heroBtns}>
          <button className={styles.btnPrimary} onClick={goToFreeChapters}>
            Read Free Chapters
          </button>
          <button className={styles.btnOutline} onClick={openOrder}>
            Pre-Order Now — R350
          </button>
        </div>
        <div className={styles.heroSubnote}>40 Chapters · 8 Layers · One Identity</div>
        <div className={styles.scrollHint}>Scroll to explore</div>
      </section>

      {/* BOOK COVER SHOWCASE */}
      <section className={styles.bookShowcase}>
        <Image
          className={styles.bookCoverImg}
          src="/fournity-book-cover.jpg"
          alt="FOURNITY — Trinity and I Are Four-nity, by Rev Mokoro Manana (book cover)"
          width={1071}
          height={1469}
        />
      </section>

      {/* THREE-ACT TIMELINE — signature element */}
      <section className={styles.timeline}>
        <div className={styles.container}>
          <div className={styles.timelineEyebrow}>The Architecture of FOURNITY</div>
          <h2 className={styles.timelineHeading}>
            Nothing new is revealed. <span>Everything is illuminated.</span>
          </h2>

          <div className={styles.actRow}>
            <div className={styles.actCard}>
              <div className={`${styles.actDot} ${styles.actDotUnity}`}>1</div>
              <div className={styles.actLabel}>Before Genesis 1:1</div>
              <div className={styles.actVerse}>Union</div>
              <p className={styles.actText}>
                Before the foundation of the world, Trinity and Humanity were already one.
                Identity did not begin at birth — it began before time began.
              </p>
            </div>

            <div className={styles.actCard}>
              <div className={`${styles.actDot} ${styles.actDotLoss}`}>2</div>
              <div className={`${styles.actLabel} ${styles.actLabelLoss}`}>Genesis 3</div>
              <div className={styles.actVerse}>Rupture</div>
              <p className={styles.actText}>
                The Fall did not just bring sin — it severed the union. Humanity lost sight
                of the identity it was given before it existed to ask for it.
              </p>
            </div>

            <div className={styles.actCard}>
              <div className={`${styles.actDot} ${styles.actDotRestore}`}>3</div>
              <div className={styles.actLabel}>Acts 2</div>
              <div className={styles.actVerse}>Restoration</div>
              <p className={styles.actText}>
                Pentecost did not introduce a new idea. It restored what was always true —
                Trinity and Humanity, united again, operational since the Spirit fell.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ILLUMINATION STATEMENT */}
      <section className={styles.statement}>
        <div className={styles.container}>
          <div className={styles.statementMark}>I · D · E · N · T · I · T · Y</div>
          <p className={styles.statementText}>
            <strong>FOURNITY</strong> is an Illumination of the revelation of the Unity of
            Trinity and Humanity — the Church has long been given this truth. FOURNITY does
            not teach something new. It illuminates what has long been given, but to which
            we have grown ignorant, or which we have failed to celebrate.
          </p>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className={styles.forSection}>
        <div className={styles.container}>
          <div className={styles.ctaEyebrow} style={{ textAlign: 'center' }}>
            Who FOURNITY Is For
          </div>
          <h2
            className={styles.timelineHeading}
            style={{ marginBottom: 0, textAlign: 'center' }}
          >
            For Anyone Who Has Asked &quot;Who Am I, Really?&quot;
          </h2>
          <div className={styles.forGrid}>
            <div className={styles.forCard}>
              <div className={styles.forCardTitle}>Pastors &amp; Bible Teachers</div>
              <p className={styles.forCardText}>
                A 40-chapter teaching resource with a free interactive Workbook and Dig
                Deeper Bible study appendix — ready for church groups.
              </p>
            </div>
            <div className={styles.forCard}>
              <div className={styles.forCardTitle}>Believers Rebuilding Identity</div>
              <p className={styles.forCardText}>
                For anyone who has lost sight of who they are in Christ and needs the truth
                illuminated again, layer by layer.
              </p>
            </div>
            <div className={styles.forCard}>
              <div className={styles.forCardTitle}>Kingdom Entrepreneurs</div>
              <p className={styles.forCardText}>
                Identity is the foundation of mission. FOURNITY grounds Kingdom work in who
                you already are, not who you are trying to become.
              </p>
            </div>
            <div className={styles.forCard}>
              <div className={styles.forCardTitle}>New &amp; Growing Believers</div>
              <p className={styles.forCardText}>
                Written in a pastoral, personal voice — accessible whether this is your
                first theology book or your fiftieth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING / CTA */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <div className={styles.ctaEyebrow}>Get The Complete Book</div>
          <h2 className={styles.ctaHeading}>Invest in Your Development</h2>
          <p className={styles.ctaSub}>
            This R350 is not an expense. It is for your growth. Forty chapters. Eight
            layers. One Illumination that will permanently alter how you understand
            yourself and the God who chose you before the foundation of the world.
          </p>
          <div className={styles.priceTag}>R350</div>
          <div className={styles.priceNote}>Launch price · First 100 copies · R500 thereafter</div>
          <div className={styles.featList}>
            <div className={styles.featItem}>
              <span className={styles.featIcon}>✦</span> All 40 chapters across 8 layers
            </div>
            <div className={styles.featItem}>
              <span className={styles.featIcon}>✦</span> Digital edition with Audio Reader
            </div>
            <div className={styles.featItem}>
              <span className={styles.featIcon}>✦</span> 40-chapter interactive Workbook
            </div>
            <div className={styles.featItem}>
              <span className={styles.featIcon}>✦</span> Dig Deeper Bible Study Appendix
            </div>
            <div className={styles.featItem}>
              <span className={styles.featIcon}>✦</span> Signed physical copy after printing
            </div>
          </div>
          <div>
            <button
              className={styles.btnPrimary}
              onClick={openOrder}
              style={{ fontSize: 14, padding: '18px 48px' }}
            >
              Pre-Order Now — R350
            </button>
          </div>
          <p className={styles.fullChapterNote}>
            Every chapter is the full chapter — not a summary or excerpt.
          </p>
          <p className={styles.waLine}>
            Pay by Card or Bank Transfer/EFT · Questions? WhatsApp Rev:{' '}
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">
              {WHATSAPP_DISPLAY}
            </a>
          </p>
        </div>
      </section>

      {/* ABOUT REV */}
      <section className={styles.about}>
        <div className={styles.container}>
          <div className={styles.aboutLayout}>
            <div className={styles.aboutPhoto}>
              <Image
                src="/rev-photo.png"
                alt="Rev Mokoro Manana"
                width={170}
                height={165}
              />
              <div className={styles.aboutName}>Rev Mokoro Manana</div>
              <div className={styles.aboutTitle}>
                Apostle · Author · Kingdom Entrepreneur
              </div>
            </div>
            <div>
              <div className={styles.aboutEyebrow}>The Author</div>
              <p className={styles.aboutBody}>
                <strong>FOURNITY</strong> is an <strong>ILLUMINATION</strong> God gave to
                Rev Mokoro Manana — Pastor, Apostle, Author and Founder of Zero2Billionaires
                Amavulandlela Pty Ltd — after thirty-five years of prayer, study and walking
                with the Holy Spirit.
              </p>
              <p className={styles.aboutBody}>
                <em>&quot;Before Genesis chapter one was — you were.&quot;</em>
              </p>
              <p className={styles.aboutBody}>
                Based in <strong>Gauteng, South Africa</strong>. Married to Prophetess
                Ntswaki Manana — The Hephzibah. Anchor scripture: <strong>Genesis 1:28.</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>FOURNITY</div>
        <div className={styles.footerLine}>
          Zero2Billionaires Amavulandlela Pty Ltd · Gauteng, South Africa
        </div>
        <div className={styles.footerLine}>
          WhatsApp:{' '}
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">
            {WHATSAPP_DISPLAY}
          </a>
        </div>
      </footer>

      {/* LEAD GATE OVERLAY */}
      <div className={`${styles.overlay} ${gateOpen ? styles.open : ''}`}>
        <div className={styles.overlayCard}>
          <button className={styles.overlayClose} onClick={() => setGateOpen(false)}>
            ×
          </button>
          <div className={styles.overlayTitle}>Access Your Free Preview</div>
          <div className={styles.overlaySub}>
            Read the first chapter of every Layer — free. No payment required.
          </div>
          {leadErr && <div className={styles.errBox}>{leadErr}</div>}
          <form onSubmit={submitLead}>
            <div className={styles.field}>
              <label>Full Name</label>
              <input
                type="text"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className={styles.field}>
              <label>Email Address</label>
              <input
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div className={styles.field}>
              <label>WhatsApp Number</label>
              <input
                type="tel"
                value={leadWhatsapp}
                onChange={(e) => setLeadWhatsapp(e.target.value)}
                placeholder="e.g. 0771234567"
              />
            </div>
            <button className={styles.btnPrimary} style={{ width: '100%' }} disabled={leadBusy}>
              {leadBusy ? 'Please wait...' : 'Read Free Preview →'}
            </button>
          </form>
        </div>
      </div>

      {/* ORDER FORM OVERLAY */}
      <div className={`${styles.overlay} ${orderOpen ? styles.open : ''}`}>
        <div className={styles.overlayCard}>
          <button className={styles.overlayClose} onClick={() => setOrderOpen(false)}>
            ×
          </button>
          <div className={styles.overlayTitle}>FOURNITY — Pre-Order</div>
          <div className={styles.overlaySub}>
            This R350 is not an expense. It is for your growth.
          </div>
          {orderErr && <div className={styles.errBox}>{orderErr}</div>}
          <form onSubmit={submitOrder}>
            <div className={styles.field}>
              <label>Full Name</label>
              <input
                type="text"
                value={order.name}
                onChange={(e) => updateOrder('name', e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className={styles.field}>
              <label>Email Address</label>
              <input
                type="email"
                value={order.email}
                onChange={(e) => updateOrder('email', e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div className={styles.field}>
              <label>WhatsApp Number</label>
              <input
                type="tel"
                value={order.whatsapp}
                onChange={(e) => updateOrder('whatsapp', e.target.value)}
                placeholder="+27 ..."
              />
            </div>
            <div className={styles.field}>
              <label>Street Address</label>
              <input
                type="text"
                value={order.address}
                onChange={(e) => updateOrder('address', e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Suburb</label>
                <input
                  type="text"
                  value={order.suburb}
                  onChange={(e) => updateOrder('suburb', e.target.value)}
                  placeholder="Suburb"
                />
              </div>
              <div className={styles.field}>
                <label>City</label>
                <input
                  type="text"
                  value={order.city}
                  onChange={(e) => updateOrder('city', e.target.value)}
                  placeholder="City"
                />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Postal Code</label>
                <input
                  type="text"
                  value={order.postal}
                  onChange={(e) => updateOrder('postal', e.target.value)}
                  placeholder="0000"
                />
              </div>
              <div className={styles.field}>
                <label>Province</label>
                <input
                  type="text"
                  value={order.province}
                  onChange={(e) => updateOrder('province', e.target.value)}
                  placeholder="Province"
                />
              </div>
            </div>
            <button className={styles.btnPrimary} style={{ width: '100%' }} disabled={orderBusy}>
              Proceed to Payment →
            </button>
            <p className={styles.waLine} style={{ textAlign: 'center', marginTop: 14 }}>
              Questions? WhatsApp Rev directly:{' '}
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">
                {WHATSAPP_DISPLAY}
              </a>
            </p>
          </form>
        </div>
      </div>

      {/* PAYMENT METHOD OVERLAY */}
      <div className={`${styles.overlay} ${paymentChoiceOpen ? styles.open : ''}`}>
        <div className={styles.overlayCard}>
          <button
            className={styles.overlayClose}
            onClick={() => {
              setPaymentChoiceOpen(false);
              setShowBankDetails(false);
            }}
          >
            ×
          </button>
          <div className={styles.overlayTitle}>Choose Payment Method</div>
          <div className={styles.overlaySub}>R350 — FOURNITY Pre-Order</div>

          <button className={`${styles.btnPrimary} ${styles.paymentChoiceBtn}`} onClick={payWithYoco}>
            💳 Pay with Card via Yoco
          </button>
          <button className={`${styles.btnOutline} ${styles.paymentChoiceBtn}`} onClick={payWithEft}>
            🏦 Pay via Bank Transfer / EFT
          </button>

          {showBankDetails && (
            <div className={styles.bankBox}>
              <div className={styles.bankBoxLabel}>Banking Details</div>
              <div>
                <strong>Account Name:</strong> Zero2Billionaires Amavulandlela Pty Ltd
              </div>
              <div>
                <strong>Bank:</strong> Nedbank
              </div>
              <div>
                <strong>Account Number:</strong> 1318257727
              </div>
              <div>
                <strong>Reference:</strong> FOURNITY + Your Name
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12, fontStyle: 'italic' }}>
                After paying, please send your Proof of Payment via WhatsApp so we can
                confirm and send your digital edition immediately.
              </p>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noreferrer"
                className={styles.waButton}
              >
                📲 Send Proof of Payment on WhatsApp
              </a>
              <button
                className={styles.btnPrimary}
                style={{ width: '100%', marginTop: 14, fontSize: 12, padding: '12px 0' }}
                onClick={confirmEftSubmitted}
              >
                I&apos;ve Made the Payment — Notify Rev
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SUCCESS OVERLAY */}
      <div className={`${styles.overlay} ${successOpen ? styles.open : ''}`}>
        <div className={styles.overlayCard} style={{ textAlign: 'center' }}>
          <button className={styles.overlayClose} onClick={() => setSuccessOpen(false)}>
            ×
          </button>
          <div className={styles.successIcon}>🎉</div>
          <p
            style={{
              fontSize: 10,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: 'var(--gold)',
              marginBottom: 12,
            }}
          >
            Order Received
          </p>
          <h2 className={styles.overlayTitle}>Welcome, {successName}!</h2>
          <p className={styles.successText}>
            You are now a Founding Reader of FOURNITY. Your digital edition with Audio
            Reader will be sent to your email shortly. Rev Mokoro Manana will contact you
            on WhatsApp to confirm your signed copy delivery once printing is complete.
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Reference: {successRef}</p>
        </div>
      </div>
    </div>
  );
}
