import React from "react";

interface AnimatedSubscribeButtonProps {
  buttonColor: string;
  buttonTextColor?: string;
  subscribeStatus: boolean;
  initialText: React.ReactNode;
  changeText: React.ReactNode;
}

// Bouton d'envoi du formulaire : passe à « Sent » une fois le message parti
// (transition CSS, voir .send-button dans index.css).
export const AnimatedSubscribeButton: React.FC<AnimatedSubscribeButtonProps> = ({
  buttonColor,
  subscribeStatus,
  buttonTextColor,
  changeText,
  initialText,
}) => (
  <button
    type={subscribeStatus ? "button" : "submit"}
    disabled={subscribeStatus}
    className={`send-button ${subscribeStatus ? "is-sent" : ""}`}
    style={
      subscribeStatus
        ? { backgroundColor: "#ffffff", color: buttonColor }
        : { backgroundColor: buttonColor, color: buttonTextColor }
    }
  >
    <span key={subscribeStatus ? "sent" : "send"} className="send-button__label">
      {subscribeStatus ? changeText : initialText}
    </span>
  </button>
);
