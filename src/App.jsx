import { Contact, Experience, Hero, Navbar, Portfolio, NotificationToast, Rmbutton } from "./components";

const App = () => (
  <div className="relative bg-primary">
    <Rmbutton />
    <Navbar />

    <main>
      <div id="hero">
        <Hero />
      </div>
      <div id="portfolio" className="relative bg-primary">
        <Portfolio />
      </div>
      <div id="experience" className="relative bg-primary">
        <Experience />
      </div>
      <div id="contact" className="relative bg-primary">
        <Contact />
      </div>
    </main>

    <NotificationToast />
  </div>
);

export default App;
