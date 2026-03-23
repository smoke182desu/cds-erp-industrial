import { Component } from "../types";

export const COMPONENT_LIBRARY: Record<string, Component> = {
  // Cantoneiras (L-profiles)
  cantoneira_1: { id: "lib_cantoneira_1", name: "Cantoneira 1\"", width: 25.4, height: 25.4, quantity: 1, type: "Profile", description: "Cantoneira 1\"" },
  cantoneira_1_14: { id: "lib_cantoneira_1_14", name: "Cantoneira 1.1/4\"", width: 31.75, height: 31.75, quantity: 1, type: "Profile", description: "Cantoneira 1.1/4\"" },
  cantoneira_1_12: { id: "lib_cantoneira_1_12", name: "Cantoneira 1.1/2\"", width: 38.1, height: 38.1, quantity: 1, type: "Profile", description: "Cantoneira 1.1/2\"" },
  cantoneira_2: { id: "lib_cantoneira_2", name: "Cantoneira 2\"", width: 50.8, height: 50.8, quantity: 1, type: "Profile", description: "Cantoneira 2\"" },

  // Vigas I (I-beams)
  viga_i_w150: { id: "lib_viga_i_w150", name: "Viga I W150", width: 150, height: 150, quantity: 1, type: "I-Beam", description: "Viga I W150" },
  viga_i_w200: { id: "lib_viga_i_w200", name: "Viga I W200", width: 200, height: 200, quantity: 1, type: "I-Beam", description: "Viga I W200" },
  viga_i_w250: { id: "lib_viga_i_w250", name: "Viga I W250", width: 250, height: 250, quantity: 1, type: "I-Beam", description: "Viga I W250" },

  // Vigas U (U-profiles)
  viga_u_3: { id: "lib_viga_u_3", name: "Viga U 3\"", width: 76.2, height: 38.1, quantity: 1, type: "U-Profile", description: "Viga U 3\"" },
  viga_u_4: { id: "lib_viga_u_4", name: "Viga U 4\"", width: 101.6, height: 50.8, quantity: 1, type: "U-Profile", description: "Viga U 4\"" },
  viga_u_6: { id: "lib_viga_u_6", name: "Viga U 6\"", width: 152.4, height: 63.5, quantity: 1, type: "U-Profile", description: "Viga U 6\"" },
  viga_u_8: { id: "lib_viga_u_8", name: "Viga U 8\"", width: 203.2, height: 76.2, quantity: 1, type: "U-Profile", description: "Viga U 8\"" },

  // Tubos Quadrados (Square tubes)
  tubo_sq_30: { id: "lib_tubo_sq_30", name: "Tubo Quadrado 30x30", width: 30, height: 30, quantity: 1, type: "SquareTube", description: "Tubo Quadrado 30x30" },
  tubo_sq_40: { id: "lib_tubo_sq_40", name: "Tubo Quadrado 40x40", width: 40, height: 40, quantity: 1, type: "SquareTube", description: "Tubo Quadrado 40x40" },
  tubo_sq_50: { id: "lib_tubo_sq_50", name: "Tubo Quadrado 50x50", width: 50, height: 50, quantity: 1, type: "SquareTube", description: "Tubo Quadrado 50x50" },
  tubo_sq_100: { id: "lib_tubo_sq_100", name: "Tubo Quadrado 100x100", width: 100, height: 100, quantity: 1, type: "SquareTube", description: "Tubo Quadrado 100x100" },

  // Tubos Retangulares (Rectangular tubes)
  tubo_rect_50x30: { id: "lib_tubo_rect_50x30", name: "Tubo Retangular 50x30", width: 50, height: 30, quantity: 1, type: "RectangularTube", description: "Tubo Retangular 50x30" },
  tubo_rect_60x40: { id: "lib_tubo_rect_60x40", name: "Tubo Retangular 60x40", width: 60, height: 40, quantity: 1, type: "RectangularTube", description: "Tubo Retangular 60x40" },
  tubo_rect_80x40: { id: "lib_tubo_rect_80x40", name: "Tubo Retangular 80x40", width: 80, height: 40, quantity: 1, type: "RectangularTube", description: "Tubo Retangular 80x40" },
  tubo_rect_100x50: { id: "lib_tubo_rect_100x50", name: "Tubo Retangular 100x50", width: 100, height: 50, quantity: 1, type: "RectangularTube", description: "Tubo Retangular 100x50" },

  // Tubos Redondos (Round tubes)
  tubo_round_1: { id: "lib_tubo_round_1", name: "Tubo Redondo 1\"", width: 25.4, height: 25.4, quantity: 1, type: "RoundTube", description: "Tubo Redondo 1\"" },
  tubo_round_1_14: { id: "lib_tubo_round_1_14", name: "Tubo Redondo 1.1/4\"", width: 31.75, height: 31.75, quantity: 1, type: "RoundTube", description: "Tubo Redondo 1.1/4\"" },
  tubo_round_1_12: { id: "lib_tubo_round_1_12", name: "Tubo Redondo 1.1/2\"", width: 38.1, height: 38.1, quantity: 1, type: "RoundTube", description: "Tubo Redondo 1.1/2\"" },
  tubo_round_2: { id: "lib_tubo_round_2", name: "Tubo Redondo 2\"", width: 50.8, height: 50.8, quantity: 1, type: "RoundTube", description: "Tubo Redondo 2\"" },

  // Outros
  dobradica_padrao: { id: "lib_dobradica_padrao", name: "Dobradiça Padrão", width: 30, height: 80, quantity: 1, type: "Hinge", description: "Dobradiça de aço carbono para portas" },
  puxador_tubular: { id: "lib_puxador_tubular", name: "Puxador Tubular", width: 20, height: 200, quantity: 1, type: "RoundTube", description: "Puxador tubular em aço" },
  gonzo_padrao: { id: "lib_gonzo_padrao", name: "Gonzo Padrão 1/2\"", width: 15, height: 40, quantity: 1, type: "Hinge", description: "Gonzo de aço para portas e portões, substitui dobradiças padrão" },
  chapa_base: { id: "lib_chapa_base", name: "Chapa Base 100x100x6mm", width: 100, height: 100, quantity: 1, type: "Flat", thickness: 6, description: "Chapa de base para fixação de pilares no chão" },
  chapa_ligacao: { id: "lib_chapa_ligacao", name: "Chapa de Ligação 50x50x3mm", width: 50, height: 50, quantity: 1, type: "Flat", thickness: 3, description: "Chapa de ligação para união de perfis" },
  parafuso_fixacao: { id: "lib_parafuso_fixacao", name: "Parafuso Sextavado M10", width: 10, height: 30, quantity: 1, type: "Parametric", description: "Parafuso para fixação estrutural" }
};
