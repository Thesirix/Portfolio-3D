// Enveloppe commune des sections : largeur maximale et marges fluides.
// Les apparitions au scroll sont gérées dans chaque section avec <Reveal>.
const SectionWrapper = (Component, idName) =>
  function HOC() {
    return (
      <section className="section" aria-labelledby={`${idName}-title`}>
        <Component />
      </section>
    );
  };

export default SectionWrapper;
