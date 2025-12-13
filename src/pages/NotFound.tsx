import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Home,
  Search,
  ArrowLeft,
  Rocket,
  Ghost,
  Sparkles,
  Compass,
  Book,
  Users,
  MessageSquare,
  Clock,
  Target,
  Zap,
  TrendingUp,
} from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    
    // Random glitch effect
    const glitchInterval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);
    }, 4000);

    return () => clearInterval(glitchInterval);
  }, [location.pathname]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMousePosition({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const quickLinks = [
    { icon: Home, label: "Dashboard", path: "/", color: "from-blue-500 to-cyan-500" },
    { icon: Target, label: "Tasks", path: "/tasks", color: "from-purple-500 to-pink-500" },
    { icon: MessageSquare, label: "Chat", path: "/chat", color: "from-green-500 to-teal-500" },
    { icon: Clock, label: "Pomodoro", path: "/pomodoro", color: "from-orange-500 to-red-500" },
    { icon: Users, label: "Study Rooms", path: "/study-rooms", color: "from-indigo-500 to-purple-500" },
    { icon: Book, label: "Notes", path: "/notes", color: "from-yellow-500 to-orange-500" },
  ];

  const floatingElements = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 10 + Math.random() * 10,
    size: 20 + Math.random() * 40,
  }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.8, rotateY: -15 },
    visible: {
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: { type: "spring", stiffness: 100, damping: 15 },
    },
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Animated panoramic background */}
      <motion.div 
        className="fixed inset-0 -z-10 overflow-hidden"
        animate={{
          x: mousePosition.x * 8,
          y: mousePosition.y * 8,
        }}
        transition={{
          type: "spring",
          stiffness: 20,
          damping: 50,
          mass: 2,
        }}
      >
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
        
        {/* Animated mesh gradient */}
        <div className="absolute inset-0 opacity-40">
          <motion.div
            className="absolute inset-0"
            animate={{
              background: [
                'radial-gradient(circle at 0% 0%, hsl(var(--primary) / 0.3) 0%, transparent 50%), radial-gradient(circle at 100% 100%, hsl(var(--accent) / 0.3) 0%, transparent 50%)',
                'radial-gradient(circle at 100% 0%, hsl(var(--accent) / 0.3) 0%, transparent 50%), radial-gradient(circle at 0% 100%, hsl(var(--primary) / 0.3) 0%, transparent 50%)',
                'radial-gradient(circle at 0% 0%, hsl(var(--primary) / 0.3) 0%, transparent 50%), radial-gradient(circle at 100% 100%, hsl(var(--accent) / 0.3) 0%, transparent 50%)',
              ],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
        
        {/* Floating orbs with panoramic effect */}
        <div className="absolute inset-0">
          {[
            { x: '10%', y: '20%', size: 'w-96 h-96', color: 'bg-primary/20', delay: 0, parallax: 0.5 },
            { x: '80%', y: '60%', size: 'w-[500px] h-[500px]', color: 'bg-accent/20', delay: 1, parallax: 0.3 },
            { x: '50%', y: '30%', size: 'w-[400px] h-[400px]', color: 'bg-secondary/15', delay: 2, parallax: 0.7 },
            { x: '20%', y: '70%', size: 'w-80 h-80', color: 'bg-purple-500/15', delay: 1.5, parallax: 0.4 },
            { x: '70%', y: '10%', size: 'w-72 h-72', color: 'bg-blue-500/15', delay: 0.5, parallax: 0.6 },
          ].map((orb, i) => (
            <motion.div
              key={i}
              className={`absolute ${orb.size} ${orb.color} rounded-full blur-3xl`}
              style={{ left: orb.x, top: orb.y }}
              animate={{
                scale: [1, 1.2, 1],
                x: [0, 30 + mousePosition.x * orb.parallax * 10, -30 + mousePosition.x * orb.parallax * 10, 0],
                y: [0, -30 + mousePosition.y * orb.parallax * 10, 30 + mousePosition.y * orb.parallax * 10, 0],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 8 + i * 2,
                repeat: Infinity,
                delay: orb.delay,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        
        {/* Grid overlay for depth */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px',
          }}
        />
        
        {/* Scanline effect */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground) / 0.03) 2px, hsl(var(--foreground) / 0.03) 4px)',
          }}
          animate={{
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      {/* Floating geometric shapes */}
      {floatingElements.map((element) => (
        <motion.div
          key={element.id}
          className="absolute pointer-events-none"
          style={{
            left: `${element.left}%`,
            width: element.size,
            height: element.size,
          }}
          animate={{
            y: ["0vh", "100vh"],
            rotate: [0, 360],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: element.duration,
            repeat: Infinity,
            delay: element.delay,
            ease: "linear",
          }}
        >
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg backdrop-blur-sm" />
        </motion.div>
      ))}

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-6xl w-full"
        >
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left side - 404 Animation */}
            <motion.div variants={itemVariants} className="order-2 lg:order-1">
              <div className="relative">
                {/* Main 404 text with glitch effect */}
                <motion.div
                  className="relative"
                  onHoverStart={() => setIsHovering(true)}
                  onHoverEnd={() => setIsHovering(false)}
                >
                  <motion.h1
                    className={`text-[150px] md:text-[200px] lg:text-[250px] font-black text-transparent bg-clip-text bg-gradient-to-br from-primary via-accent to-secondary leading-none select-none ${
                      glitchActive ? "animate-pulse" : ""
                    }`}
                    animate={{
                      scale: isHovering ? 1.05 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 300 }}
                    style={{
                      filter: glitchActive ? "blur(2px)" : "none",
                    }}
                  >
                    404
                  </motion.h1>
                  
                  {/* Glitch layers */}
                  {glitchActive && (
                    <>
                      <motion.h1
                        className="absolute inset-0 text-[150px] md:text-[200px] lg:text-[250px] font-black text-primary/50 leading-none select-none"
                        initial={{ x: 0 }}
                        animate={{ x: [-5, 5, -5] }}
                        transition={{ duration: 0.2 }}
                      >
                        404
                      </motion.h1>
                      <motion.h1
                        className="absolute inset-0 text-[150px] md:text-[200px] lg:text-[250px] font-black text-accent/50 leading-none select-none"
                        initial={{ x: 0 }}
                        animate={{ x: [5, -5, 5] }}
                        transition={{ duration: 0.2 }}
                      >
                        404
                      </motion.h1>
                    </>
                  )}
                </motion.div>

                {/* Floating ghost icon */}
                <motion.div
                  className="absolute -top-12 -right-12 opacity-30"
                  animate={{
                    y: [0, -20, 0],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Ghost className="w-24 h-24 text-primary" />
                </motion.div>

                {/* Rocket */}
                <motion.div
                  className="absolute -bottom-8 -left-8 opacity-20"
                  animate={{
                    x: [-20, 20, -20],
                    rotate: [-15, 15, -15],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Rocket className="w-20 h-20 text-accent" />
                </motion.div>
              </div>
            </motion.div>

            {/* Right side - Content */}
            <motion.div variants={itemVariants} className="order-1 lg:order-2 space-y-6">
              <Card className="p-8 md:p-10 bg-card/50 backdrop-blur-xl border-border/50 shadow-2xl">
                <motion.div variants={cardVariants}>
                  <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6"
                    animate={{
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Error 404</span>
                  </motion.div>

                  <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
                    Oops! Lost in
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                      Cyberspace
                    </span>
                  </h2>

                  <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                    The page you're looking for seems to have taken an unexpected study break. 
                    Let's get you back on track!
                  </p>

                  <div className="flex flex-wrap gap-3 mb-8">
                    <Button
                      size="lg"
                      onClick={() => navigate(-1)}
                      className="group bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                      Go Back
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => navigate("/")}
                      className="group border-border hover:bg-accent/10"
                    >
                      <Home className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                      Home
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => navigate("/discovery")}
                      className="group border-border hover:bg-secondary/10"
                    >
                      <Compass className="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                      Explore
                    </Button>
                  </div>

                  {/* Quick links section */}
                  <div className="border-t border-border/50 pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-5 h-5 text-accent" />
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                        Quick Links
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {quickLinks.map((link, index) => (
                        <motion.button
                          key={link.path}
                          onClick={() => navigate(link.path)}
                          className="group relative overflow-hidden rounded-xl p-4 bg-card border border-border/50 hover:border-border transition-all text-left"
                          variants={itemVariants}
                          whileHover={{ scale: 1.05, y: -5 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                          <link.icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors mb-2" />
                          <p className="text-sm font-medium text-foreground truncate">
                            {link.label}
                          </p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Bottom decoration */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-secondary opacity-50" />
    </div>
  );
};

export default NotFound;
