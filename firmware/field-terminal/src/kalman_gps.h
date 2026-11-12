#pragma once

#include <math.h>
#include <stdint.h>

/**
 * Recursive 1D/2D Linear Kalman Filter for NEO-6M GNSS smoothing.
 * Reduces multipath GPS jitter while staying lightweight on ESP32.
 */
class KalmanGPS {
public:
    explicit KalmanGPS(float processNoiseM = 1.5f)
        : _initialized(false),
          _lat(0.0),
          _lng(0.0),
          _varianceM2(0.0f),
          _qM2(processNoiseM * processNoiseM) {}

    void reset() {
        _initialized = false;
        _varianceM2 = 0.0f;
    }

    /**
     * Feed a new GNSS measurement and return the smoothed state.
     * @param latMeas   Measured latitude in degrees
     * @param lngMeas   Measured longitude in degrees
     * @param accuracyM Estimated horizontal accuracy in meters (e.g. from HDOP * 2.5)
     */
    void update(double latMeas, double lngMeas, float accuracyM) {
        if (accuracyM < 1.0f) {
            accuracyM = 1.0f;
        }
        float rM2 = accuracyM * accuracyM;

        if (!_initialized) {
            _lat = latMeas;
            _lng = lngMeas;
            _varianceM2 = rM2;
            _initialized = true;
            return;
        }

        // Prediction step: uncertainty grows by process noise Q
        _varianceM2 += _qM2;

        // Kalman Gain K = P / (P + R)
        float k = _varianceM2 / (_varianceM2 + rM2);

        // Update state estimate
        _lat += (double)k * (latMeas - _lat);
        _lng += (double)k * (lngMeas - _lng);

        // Update estimate uncertainty P = (1 - K) * P
        _varianceM2 = (1.0f - k) * _varianceM2;
    }

    bool isInitialized() const { return _initialized; }
    double lat() const { return _lat; }
    double lng() const { return _lng; }

    uint16_t accuracyCm() const {
        if (!_initialized) return 5000;
        float cm = sqrtf(_varianceM2) * 100.0f;
        if (cm > 65535.0f) cm = 65535.0f;
        return (uint16_t)cm;
    }

private:
    bool   _initialized;
    double _lat;
    double _lng;
    float  _varianceM2;
    float  _qM2;
};

