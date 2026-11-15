import { useEffect, useState } from "react";
import successSound from "../assets/linked.mp3";

// Petites notifications en bas à gauche (remplace react-toastify).
// notifySuccess / notifyError peuvent être appelées de n'importe où.
const listeners = new Set();
let nextId = 1;

function push(type, message) {
  const toast = { id: nextId++, type, message };
  listeners.forEach((fn) => fn(toast));
}

export const notifySuccess = (message) => {
  push("success", message);
  // le son n'est téléchargé qu'au moment où il sert
  new Audio(successSound).play().catch(() => {});
};

export const notifyError = (message) => push("error", message);

const DURATION = 3000;

const NotificationToast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const add = (t) => {
      setToasts((list) => [...list, t]);
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), DURATION);
    };
    listeners.add(add);
    return () => listeners.delete(add);
  }, []);

  const close = (id) => setToasts((list) => list.filter((x) => x.id !== id));

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" className={`toast toast--${t.type}`} onClick={() => close(t.id)}>
          <span className="toast__icon" aria-hidden="true">
            {t.type === "success" ? "✓" : "!"}
          </span>
          {t.message}
          <span className="toast__bar" style={{ animationDuration: `${DURATION}ms` }} />
        </button>
      ))}
    </div>
  );
};

export default NotificationToast;
