import { CoolMode } from "./CoolMode.tsx";
import profileImage from "../assets/profile.webp";

// Initiales en haut à gauche : clic maintenu = pluie de photos de profil
const PARTICLES = { particle: profileImage, particleCount: 50, speedHorz: 5 };

const Rmbutton = () => (
  <div className="absolute top-3 left-1 m-4 z-30">
    <CoolMode options={PARTICLES}>
      <button
        type="button"
        className="text-white text-[26px] lg:text-[36px] font-bold cursor-pointer bg-transparent border-none"
        title="Clique et maintiens"
      >
        RM
      </button>
    </CoolMode>
  </div>
);

export default Rmbutton;
