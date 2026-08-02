# Install ttyd (terminal sharing over web)
if ! command -v ttyd &> /dev/null; then
    echo "Installing ttyd..."
    TTYD_VERSION="1.7.7"
    ARCH=$(uname -m)

    case "$ARCH" in
        x86_64)  TTYD_ARCH="x86_64" ;;
        aarch64) TTYD_ARCH="aarch64" ;;
        armv7l)  TTYD_ARCH="armhf" ;;
        armv6l)  TTYD_ARCH="arm" ;;
        i686)    TTYD_ARCH="i686" ;;
        mips)    TTYD_ARCH="mips" ;;
        mips64)  TTYD_ARCH="mips64" ;;
        mips64el) TTYD_ARCH="mips64el" ;;
        mipsel)  TTYD_ARCH="mipsel" ;;
        s390x)   TTYD_ARCH="s390x" ;;
        *)       echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    sudo curl -fsSL -o /usr/local/bin/ttyd "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.${TTYD_ARCH}"
    sudo chmod +x /usr/local/bin/ttyd
    echo "ttyd ${TTYD_VERSION} installed."
else
    echo "ttyd already installed."
fi
