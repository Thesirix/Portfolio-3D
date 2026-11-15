import { useState } from "react";
import { SectionWrapper } from "../hoc";
import { styles } from "../styles.js";
import Reveal from "./Reveal.jsx";
import { AnimatedSubscribeButton } from "./AnimatedSubscribeButton.tsx";
import { Dock } from "./Dock";
import { notifySuccess, notifyError } from "./NotificationToast.jsx";

const ChevronIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const CheckIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const fieldClass =
  "bg-tertiary p-4 text-white border border-white/70 font-medium rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-quaternary";

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) return notifyError("Le nom est requis");
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
      return notifyError("Une adresse email valide est requise");
    }
    if (!form.message.trim()) return notifyError("Le message est requis");

    setSent(true);
    try {
      // Envoi via Netlify Forms (formulaire "contact" déclaré dans index.html)
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ "form-name": "contact", ...form }).toString(),
      });
      if (!response.ok) throw new Error(response.statusText);
      notifySuccess("Email envoyé avec succès !");
      setForm({ name: "", email: "", message: "" });
    } catch {
      notifyError("Erreur lors de l'envoi de l'email. Veuillez réessayer plus tard.");
      setSent(false);
    }
  };

  return (
    <Reveal className="mx-auto w-full max-w-2xl">
      <h2 id="contact-title" className={styles.sectionText}>
        Contact
      </h2>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3" noValidate>
        <label htmlFor="name" className="text-white font-semibold mt-2">
          Full Name
        </label>
        <input
          id="name"
          type="text"
          name="name"
          autoComplete="name"
          placeholder="Enter your full name"
          className={fieldClass}
          value={form.name}
          onChange={update("name")}
          required
        />
        <label htmlFor="email" className="text-white font-semibold mt-2">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Enter your email address"
          className={fieldClass}
          value={form.email}
          onChange={update("email")}
          required
        />
        <label htmlFor="message" className="text-white font-semibold mt-2">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          placeholder="Enter your message"
          rows={5}
          className={`${fieldClass} min-h-[8rem] resize-y`}
          value={form.message}
          onChange={update("message")}
          required
        />

        <div className="mt-3">
          <AnimatedSubscribeButton
            buttonColor="#000000"
            buttonTextColor="#ffffff"
            subscribeStatus={sent}
            initialText={
              <span className="group inline-flex items-center">
                Send <ChevronIcon className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            }
            changeText={
              <span className="group inline-flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" />
                Sent
              </span>
            }
          />
        </div>
      </form>

      <Dock className="mt-10" />
    </Reveal>
  );
};

export default SectionWrapper(Contact, "contact");
