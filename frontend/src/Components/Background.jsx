export default function Background() {
  return (
    <div
      className="fixed inset-0 -z-10"
      style={{
        backgroundColor: '#0a0a0a',
        backgroundImage: `
          radial-gradient(at 27% 37%, hsla(215, 98%, 61%, 0.15) 0px, transparent 50%),
          radial-gradient(at 97% 21%, hsla(125, 100%, 50%, 0.15) 0px, transparent 50%),
          radial-gradient(at 52% 99%, hsla(197, 100%, 50%, 0.15) 0px, transparent 50%),
          radial-gradient(at 10% 29%, hsla(337, 100%, 50%, 0.15) 0px, transparent 50%),
          radial-gradient(at 97% 96%, hsla(48, 100%, 50%, 0.15) 0px, transparent 50%),
          radial-gradient(at 33% 50%, hsla(176, 100%, 50%, 0.15) 0px, transparent 50%),
          radial-gradient(at 79% 53%, hsla(222, 100%, 50%, 0.15) 0px, transparent 50%)
        `,
      }}
    />
  );
}
