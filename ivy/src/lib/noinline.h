#ifndef IVY_NOINLINE_H
#define IVY_NOINLINE_H

/* Detect compiler and define NOINLINE macro appropriately */
#if defined(_MSC_VER) /* Microsoft Visual C++ */
    #define NOINLINE __declspec(noinline)
#elif defined(__GNUC__) || defined(__clang__) /* GCC, Clang, or compatible compilers */
    #define NOINLINE __attribute__((noinline))
#elif defined(__INTEL_COMPILER) /* Intel C/C++ Compiler */
    #if defined(_WIN32)
        #define NOINLINE __declspec(noinline)
    #else
        #define NOINLINE __attribute__((noinline))
    #endif
#elif defined(__SUNPRO_C) || defined(__SUNPRO_CC) /* Oracle Solaris Studio */
    #define NOINLINE __attribute__((noinline))
#elif defined(__HP_cc) || defined(__HP_aCC) /* HP C/aC++ */
    #define NOINLINE __attribute__((noinline))
#elif defined(__IBMC__) || defined(__IBMCPP__) /* IBM XL C/C++ */
    #define NOINLINE __attribute__((noinline))
#else
    #error "Can't find NOINLINE"
#endif

#endif /* IVY_NOINLINE_H */
