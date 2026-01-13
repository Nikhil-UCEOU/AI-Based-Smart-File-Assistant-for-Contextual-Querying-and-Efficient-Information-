import React from 'react';
import styled, { keyframes } from 'styled-components';

const float = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-30px) rotate(120deg); }
  66% { transform: translateY(15px) rotate(240deg); }
`;

const float2 = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(20px) rotate(-120deg); }
  66% { transform: translateY(-15px) rotate(-240deg); }
`;

const float3 = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(180deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
`;

const wave = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100vw); }
`;

const BackgroundContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: -1;
  background: linear-gradient(135deg, 
    #667eea 0%, 
    #764ba2 25%, 
    #f093fb 50%, 
    #f5576c 75%, 
    #4facfe 100%
  );
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;

  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

const FloatingShape = styled.div<{ 
  size: number; 
  color: string; 
  top: string; 
  left: string; 
  delay: number;
  animationType: 'float' | 'float2' | 'float3' | 'pulse';
}>`
  position: absolute;
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  background: ${props => props.color};
  border-radius: 50%;
  top: ${props => props.top};
  left: ${props => props.left};
  animation: ${props => {
    switch(props.animationType) {
      case 'float': return float;
      case 'float2': return float2;
      case 'float3': return float3;
      case 'pulse': return pulse;
      default: return float;
    }
  }} ${props => 6 + props.delay}s ease-in-out infinite;
  animation-delay: ${props => props.delay}s;
  opacity: 0.7;
  filter: blur(1px);
`;

const GeometricShape = styled.div<{
  size: number;
  color: string;
  top: string;
  left: string;
  delay: number;
  shape: 'triangle' | 'square' | 'diamond';
}>`
  position: absolute;
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  top: ${props => props.top};
  left: ${props => props.left};
  animation: float3 ${props => 8 + props.delay}s ease-in-out infinite;
  animation-delay: ${props => props.delay}s;
  opacity: 0.5;
  
  ${props => {
    switch(props.shape) {
      case 'triangle':
        return `
          width: 0;
          height: 0;
          border-left: ${props.size/2}px solid transparent;
          border-right: ${props.size/2}px solid transparent;
          border-bottom: ${props.size}px solid ${props.color};
        `;
      case 'square':
        return `
          background: ${props.color};
          border-radius: 8px;
        `;
      case 'diamond':
        return `
          background: ${props.color};
          transform: rotate(45deg);
          border-radius: 4px;
        `;
      default:
        return `background: ${props.color};`;
    }
  }}
`;

const WaveLayer = styled.div<{ delay: number; color: string }>`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 200%;
  height: 100px;
  background: linear-gradient(90deg, transparent, ${props => props.color}, transparent);
  opacity: 0.3;
  animation: wave ${props => 20 + props.delay}s linear infinite;
  animation-delay: ${props => props.delay}s;
  border-radius: 50px;
`;

const ParticleContainer = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const Particle = styled.div<{
  size: number;
  color: string;
  top: string;
  left: string;
  delay: number;
}>`
  position: absolute;
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  background: ${props => props.color};
  border-radius: 50%;
  top: ${props => props.top};
  left: ${props => props.left};
  animation: float ${props => 4 + props.delay}s ease-in-out infinite;
  animation-delay: ${props => props.delay}s;
  opacity: 0.8;
  box-shadow: 0 0 20px ${props => props.color};
`;

export const AnimatedBackground: React.FC = () => {
  const shapes = [
    { size: 80, color: 'rgba(255, 255, 255, 0.1)', top: '10%', left: '10%', delay: 0, type: 'float' as const },
    { size: 120, color: 'rgba(255, 107, 107, 0.2)', top: '20%', left: '80%', delay: 1, type: 'float2' as const },
    { size: 60, color: 'rgba(74, 144, 226, 0.15)', top: '60%', left: '15%', delay: 2, type: 'pulse' as const },
    { size: 100, color: 'rgba(245, 87, 108, 0.1)', top: '70%', left: '70%', delay: 1.5, type: 'float3' as const },
    { size: 40, color: 'rgba(255, 255, 255, 0.2)', top: '30%', left: '50%', delay: 3, type: 'float' as const },
    { size: 90, color: 'rgba(79, 172, 254, 0.15)', top: '80%', left: '30%', delay: 2.5, type: 'float2' as const },
    { size: 70, color: 'rgba(240, 147, 251, 0.1)', top: '40%', left: '85%', delay: 4, type: 'pulse' as const },
    { size: 50, color: 'rgba(255, 255, 255, 0.15)', top: '85%', left: '60%', delay: 1, type: 'float3' as const },
  ];

  const geometricShapes = [
    { size: 30, color: 'rgba(255, 255, 255, 0.1)', top: '15%', left: '25%', delay: 0, shape: 'triangle' as const },
    { size: 25, color: 'rgba(255, 107, 107, 0.15)', top: '45%', left: '75%', delay: 2, shape: 'square' as const },
    { size: 35, color: 'rgba(79, 172, 254, 0.1)', top: '75%', left: '20%', delay: 1, shape: 'diamond' as const },
    { size: 40, color: 'rgba(240, 147, 251, 0.12)', top: '25%', left: '60%', delay: 3, shape: 'triangle' as const },
  ];

  const particles = [
    { size: 4, color: '#ffffff', top: '20%', left: '30%', delay: 0 },
    { size: 6, color: '#ff6b6b', top: '50%', left: '70%', delay: 1 },
    { size: 3, color: '#4facfe', top: '80%', left: '40%', delay: 2 },
    { size: 5, color: '#f093fb', top: '35%', left: '80%', delay: 1.5 },
    { size: 4, color: '#ffffff', top: '65%', left: '10%', delay: 2.5 },
    { size: 7, color: '#f5576c', top: '90%', left: '90%', delay: 3 },
  ];

  const waves = [
    { delay: 0, color: 'rgba(255, 255, 255, 0.1)' },
    { delay: 5, color: 'rgba(79, 172, 254, 0.1)' },
    { delay: 10, color: 'rgba(240, 147, 251, 0.1)' },
  ];

  return (
    <BackgroundContainer>
      {/* Floating Shapes */}
      {shapes.map((shape, index) => (
        <FloatingShape
          key={`shape-${index}`}
          size={shape.size}
          color={shape.color}
          top={shape.top}
          left={shape.left}
          delay={shape.delay}
          animationType={shape.type}
        />
      ))}

      {/* Geometric Shapes */}
      {geometricShapes.map((shape, index) => (
        <GeometricShape
          key={`geo-${index}`}
          size={shape.size}
          color={shape.color}
          top={shape.top}
          left={shape.left}
          delay={shape.delay}
          shape={shape.shape}
        />
      ))}

      {/* Wave Layers */}
      {waves.map((wave, index) => (
        <WaveLayer
          key={`wave-${index}`}
          delay={wave.delay}
          color={wave.color}
        />
      ))}

      {/* Particles */}
      <ParticleContainer>
        {particles.map((particle, index) => (
          <Particle
            key={`particle-${index}`}
            size={particle.size}
            color={particle.color}
            top={particle.top}
            left={particle.left}
            delay={particle.delay}
          />
        ))}
      </ParticleContainer>
    </BackgroundContainer>
  );
};

export default AnimatedBackground;