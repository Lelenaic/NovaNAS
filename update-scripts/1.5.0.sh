sudo apt update
sudo apt install nut -yqq

# Reload udev rules so NUT drivers can access USB UPS devices
sudo udevadm control --reload-rules
sudo udevadm trigger
