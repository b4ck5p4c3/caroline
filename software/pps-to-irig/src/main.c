#include <fcntl.h>
#include <linux/pps.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <sys/ioctl.h>
#include <termios.h>
#include <time.h>
#include <unistd.h>

#define PPS_WAIT_TIMEOUT 3

#define IRIG_VARIANT_X 2
#define IRIG_VARIANT_Y 7

#define IRIG_SERIAL_BAUDRATE ((1 << IRIG_VARIANT_Y) * 75)

static bool InitializePPS(const char* pps_device, int* pps_fd) {
  int fd = open(pps_device, O_RDWR);
  if (fd < 0) {
    fprintf(stderr, "Failed to open PPS device: %d - %m\n", fd);
    return false;
  }

  struct pps_kparams dummy;
  int ret = ioctl(fd, PPS_GETPARAMS, &dummy);
  if (ret) {
    fprintf(stderr, "Failed to get PPS params: %d - %m\n", ret);
    close(fd);
    return false;
  }

  int mode;
  ret = ioctl(fd, PPS_GETCAP, &mode);
  if (ret < 0) {
    fprintf(stderr, "Failed to get PPS capabilities: %d - %m\n", ret);
    close(fd);
    return false;
  }

  if ((mode & PPS_CAPTUREASSERT) == 0) {
    fprintf(stderr, "PPS device does not support CAPTUREASSERT\n");
    close(fd);
    return false;
  }

  if ((mode & PPS_CANWAIT) == 0) {
    fprintf(stderr, "PPS device does not support CANWAIT\n");
    close(fd);
    return false;
  }

  struct pps_kparams params;
  ret = ioctl(fd, PPS_GETPARAMS, &params);
  if (ret < 0) {
    fprintf(stderr, "Failed to get PPS params (2): %d - %m\n", ret);
    close(fd);
    return false;
  }

  params.mode |= PPS_CAPTUREASSERT;
  if ((mode & PPS_OFFSETASSERT) != 0) {
    params.mode |= PPS_OFFSETASSERT;
    params.assert_off_tu.nsec = 0;
    params.assert_off_tu.sec = 0;
  }

  ret = ioctl(fd, PPS_SETPARAMS, &params);
  if (ret < 0) {
    fprintf(stderr, "Failed to set PPS params: %d - %m\n", ret);
    close(fd);
    return false;
  }

  printf("PPS device opened: %d\n", fd);
  *pps_fd = fd;
  return true;
}

static bool InitializeSerial(const char* serial_device, int* serial_fd) {
  int fd = open(serial_device, O_RDWR | O_NOCTTY | O_SYNC);
  if (fd < 0) {
    fprintf(stderr, "Failed to open PPS device: %d - %m\n", fd);
    return false;
  }

  struct termios tty_params;
  int ret = tcgetattr(fd, &tty_params);
  if (ret) {
    fprintf(stderr, "Failed to get TTY attributes: %d - %m\n", ret);
    return false;
  }

  cfsetospeed(&tty_params, IRIG_SERIAL_BAUDRATE);
  cfsetispeed(&tty_params, IRIG_SERIAL_BAUDRATE);

  tty_params.c_cflag = (tty_params.c_cflag & ~CSIZE) | CS7;
  tty_params.c_iflag &= ~IGNBRK;
  tty_params.c_lflag = 0;
  tty_params.c_oflag = 0;
  tty_params.c_cc[VMIN] = 0;
  tty_params.c_cc[VTIME] = 5;
  tty_params.c_iflag &= ~(IXON | IXOFF | IXANY);
  tty_params.c_cflag |= (CLOCAL | CREAD);
  tty_params.c_cflag |= PARENB | PARODD;
  tty_params.c_cflag &= ~CSTOPB;
  tty_params.c_cflag &= ~CRTSCTS;

  ret = tcsetattr(fd, TCSANOW, &tty_params);
  if (ret) {
    fprintf(stderr, "Failed to set TTY attributes: %d - %m\n", ret);
    return false;
  }

  printf("Serial device opened: %d\n", fd);
  *serial_fd = fd;
  return true;
}

static bool WaitForPPS(int pps_fd, struct pps_ktime* assert_time) {
  struct pps_fdata fetch_data = {};
  fetch_data.timeout.sec = PPS_WAIT_TIMEOUT;
  fetch_data.timeout.nsec = 0;
  int ret = ioctl(pps_fd, PPS_FETCH, &fetch_data);
  if (ret < 0) {
    fprintf(stderr, "Failed to wait for PPS assert: %d - %m\n", ret);
    return false;
  }
  memcpy(assert_time, &fetch_data.info.assert_tu, sizeof(struct pps_ktime));
  return true;
}

static bool SendIRIG(int serial_fd, const struct pps_ktime* assert_time) {
  time_t timestamp = assert_time->sec;
  struct tm* time = gmtime(&timestamp);
  char irig_buffer[18] = {};
#if IRIG_VARIANT_X == 2
  size_t length = 17;
  strftime(irig_buffer, 18, "\x01%j:%H:%M:%S.0\r\n", time);
#elif IRIG_VARIANT_X == 1
  size_t length = 16;
  strftime(irig_buffer, 18, "\x01%j:%H:%M:%S\r\n", time);
#endif
  size_t ret = write(serial_fd, irig_buffer, length);
  if (ret != length) {
    fprintf(stderr, "Write to serial failed: %ld - %m\n", ret);
    return false;
  }
  return true;
}

int main(int argc, char** argv) {
  if (argc < 2) {
    fprintf(stderr, "Usage: %s <PPS device> <serial device>\n", argv[0]);
    return 1;
  }

  const char* pps_device = argv[1];
  const char* serial_device = argv[2];

  int pps_fd;
  int serial_fd;

  if (!InitializePPS(pps_device, &pps_fd)) {
    fprintf(stderr, "Failed to initialize PPS device\n");
    return 1;
  }

  if (!InitializeSerial(serial_device, &serial_fd)) {
    close(pps_fd);
    fprintf(stderr, "Failed to initialize serial device\n");
    return 1;
  }

  struct pps_ktime assert_time = {};

  printf("IRIG J-%d%d started on %s from %s\n", IRIG_VARIANT_X, IRIG_VARIANT_Y,
         serial_device, pps_device);

  while (true) {
    if (!WaitForPPS(pps_fd, &assert_time)) {
      close(pps_fd);
      close(serial_fd);
      fprintf(stderr, "Failed to wait for PPS\n");
      return 1;
    }
    if (!SendIRIG(serial_fd, &assert_time)) {
      close(pps_fd);
      close(serial_fd);
      fprintf(stderr, "Failed to send IRIG\n");
      return 1;
    }
  }
}
