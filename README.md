<p align="center">
  <img src="public/images/logo2.png" alt="NovaNAS Logo" width="400">
</p>

# NovaNAS

**An Open Source NAS Operating System - A Complete Alternative to CasaOS**

NovaNAS is a powerful, open-source Network Attached Storage (NAS) operating system designed as a comprehensive alternative to CasaOS. Built with Laravel and React, it provides a desktop-like interface that allows you to manage your entire system through a single, intuitive web application.

## Why NovaNAS?

CasaOS offers basic NAS functionality, but lacks the depth and completeness needed for serious home or small business storage solutions. NovaNAS fills this gap by providing enterprise-grade features comparable to commercial solutions like QNAP OS or Synology DSM, while remaining fully open-source and free.

### Key Philosophy
- **Complete System Management**: Control everything from storage to networking through one unified interface
- **Desktop-Like Experience**: Familiar window-based UI with movable, resizable windows
- **Extensible Architecture**: Easy to add new apps and features
- **Open Source**: Transparent, community-driven development

## Features

### Core System Management
- **Desktop Interface**: Window-based UI with drag-and-drop functionality
- **User Management**: Role-based access control with permissions (powered by Spatie Laravel Permission)
- **System Monitoring**: Real-time performance metrics and health monitoring
- **Terminal Access**: Direct command-line interface for advanced users

### Storage & File Management
- **Multi-Filesystem Support**: ZFS and EXT4 support for optimal data protection
- **RAID Management**: Configure and monitor storage pools
- **Shared Folders**: SMB/CIFS and NFS sharing with access controls
- **File Manager**: Web-based file browser with upload/download capabilities
- **Backup Solutions**: Automated backup to external drives or cloud storage

### Application Management
- **Docker Integration**: Install and manage Docker containers through the UI
- **App Store**: Marketplace for community-developed applications
- **Service Management**: Start, stop, and configure system services
- **Virtualization Support**: Future support for VM management

### Network & Security
- **Firewall Management**: Advanced firewall rules and port management
- **DynDNS**: Dynamic DNS configuration for remote access
- **VPN Server**: Built-in VPN for secure remote connections
- **SSL/TLS Certificates**: Automatic certificate management
- **Network Configuration**: IP settings, DHCP server, and routing

### Monitoring & Analytics
- **System Health**: CPU, memory, disk, and network monitoring
- **Log Management**: Centralized logging and log viewer
- **Resource Usage**: Track storage, bandwidth, and system resources
- **Alert System**: Email/SMS notifications for system events

### Additional Features
- **Scheduled Tasks**: Cron job management through the UI
- **Update Management**: Automated system and app updates
- **Power Management**: Sleep, hibernate, and shutdown controls
- **USB Device Support**: Mount and manage external drives
- **Printer Management**: Network printer configuration and sharing

## Installation

### System Requirements
- Debian 11/12 or Ubuntu 20.04/22.04 LTS
- Minimum 4GB RAM (8GB recommended)
- 2-core CPU minimum (4-core recommended)
- Storage: At least 20GB system drive + additional drives for data

### Quick Install
```bash
# Download and run the installer
wget https://github.com/your-org/novanas/releases/latest/download/install.sh
chmod +x install.sh
sudo ./install.sh
```

### Manual Installation
1. Clone the repository
2. Install dependencies
3. Configure your system
4. Run the setup script

Detailed installation instructions available in our [documentation](https://novanas.org/docs/installation).

## Usage

After installation, access NovaNAS through your web browser at `http://your-server-ip` (default port 80).

### First-Time Setup
1. Complete the initial configuration wizard
2. Set up your storage pools
3. Configure users and permissions
4. Install desired applications

### Managing Your NAS
- **Storage**: Configure RAID, create shared folders, set up backups
- **Applications**: Install Docker apps from the marketplace
- **Network**: Configure firewall rules, DynDNS, VPN
- **Users**: Add users, assign permissions, manage access

## Architecture

NovaNAS is built with modern web technologies:
- **Backend**: Laravel 12 (PHP 8.5) with MySQL/PostgreSQL
- **Frontend**: React with Inertia.js and Mantine UI
- **Desktop System**: Custom window manager for app organization
- **API**: RESTful API for external integrations

## Contributing

We welcome contributions from the community! Here's how you can help:

### Development Setup
```bash
git clone https://github.com/your-org/novanas.git
cd novanas
composer install
npm install
php artisan migrate
npm run dev
```

### Areas for Contribution
- New app development
- UI/UX improvements
- Feature requests and bug fixes
- Documentation
- Translation support

See our [Contributing Guide](CONTRIBUTING.md) for detailed instructions.

## Community

- **Forum**: [Discuss NovaNAS](https://forum.novanas.org)
- **Discord**: [Join our community](https://discord.gg/novanas)
- **Documentation**: [Full docs](https://novanas.org/docs)
- **Bug Reports**: [GitHub Issues](https://github.com/your-org/novanas/issues)

## License

NovaNAS is open source software licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Support

- **Documentation**: [novanas.org/docs](https://novanas.org/docs)
- **Community Support**: [Forum](https://forum.novanas.org)
- **Commercial Support**: Available for enterprise deployments

---

**NovaNAS** - Your complete, open-source NAS solution. Built for the community, by the community.
