import { getBoundary, saveBoundary } from './db';

const AMAP_KEY = 'a61008270ed21a1178ba98764312e67b';
const AMAP_SECRET = 'b6ed62df73019ef2363aa5303b6f77a9';

// Security configuration for Amap
(window as any)._AMapSecurityConfig = {
  securityJsCode: AMAP_SECRET,
};

export const loadAMap = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).AMap) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.DistrictSearch,AMap.Geocoder`;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
};

// Rate limiting queue
class RequestQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private minInterval = 200; // 5 QPS (1000ms / 5 = 200ms)

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const wait = Math.max(0, this.minInterval - (now - this.lastRequestTime));
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }

      const fn = this.queue.shift();
      if (fn) {
        this.lastRequestTime = Date.now();
        await fn();
      }
    }

    this.processing = false;
  }
}

const amapQueue = new RequestQueue();

export interface DiagnosticInfo {
  adcode: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  timestamp: number;
}

let diagnostics: DiagnosticInfo[] = [];
let diagnosticListeners: ((info: DiagnosticInfo[]) => void)[] = [];

const notifyDiagnostics = () => {
  diagnosticListeners.forEach(l => l([...diagnostics]));
};

export const subscribeToDiagnostics = (listener: (info: DiagnosticInfo[]) => void) => {
  diagnosticListeners.push(listener);
  listener([...diagnostics]);
  return () => {
    diagnosticListeners = diagnosticListeners.filter(l => l !== listener);
  };
};

const updateDiagnostic = (adcode: string, status: DiagnosticInfo['status'], message?: string) => {
  const existing = diagnostics.find(d => d.adcode === adcode);
  if (existing) {
    existing.status = status;
    existing.message = message;
    existing.timestamp = Date.now();
  } else {
    diagnostics.push({ adcode, status, message, timestamp: Date.now() });
  }
  // Keep only last 100
  if (diagnostics.length > 100) diagnostics.shift();
  notifyDiagnostics();
};

export const fetchDistrictBoundary = async (adcode: string, retryCount = 0): Promise<any> => {
  // Check cache first
  const cached = await getBoundary(adcode);
  
  const rehydrate = (data: any) => {
    if (!Array.isArray(data)) return data;
    return data.map((path: any) => {
      if (!Array.isArray(path)) return path;
      return path.map((p: any) => {
        if (Array.isArray(p)) {
          return new (window as any).AMap.LngLat(p[0], p[1]);
        }
        if (p && typeof p === 'object' && p.lng !== undefined && p.lat !== undefined) {
          return new (window as any).AMap.LngLat(p.lng, p.lat);
        }
        return p;
      });
    });
  };

  if (cached) {
    updateDiagnostic(adcode, 'success', 'From Cache');
    try {
      return rehydrate(cached.data);
    } catch (e) {
      console.warn(`Failed to rehydrate cached data for ${adcode}, fetching fresh...`);
    }
  }

  updateDiagnostic(adcode, 'pending');

  return amapQueue.add(async () => {
    return new Promise((resolve, reject) => {
      const district = new (window as any).AMap.DistrictSearch({
        extensions: 'all',
        subdistrict: 0,
      });

      district.search(adcode, async (status: string, result: any) => {
        if (status === 'complete' && result.districtList && result.districtList[0]) {
          let boundaries = result.districtList[0].boundaries;
          
          // Normalize boundaries to plain [lng, lat] arrays for reliable storage
          let normalized: any[] = [];
          if (Array.isArray(boundaries)) {
            normalized = boundaries.map((path: any) => {
              if (Array.isArray(path)) {
                return path.map((point: any) => {
                  // Handle both LngLat objects and plain objects/arrays
                  if (point.getLng && typeof point.getLng === 'function') {
                    return [point.getLng(), point.getLat()];
                  }
                  if (point.lng !== undefined && point.lat !== undefined) {
                    return [point.lng, point.lat];
                  }
                  if (Array.isArray(point)) return point;
                  return point;
                });
              }
              return path;
            });
          }

          await saveBoundary({ adcode, data: normalized });
          updateDiagnostic(adcode, 'success');
          resolve(rehydrate(normalized));
        } else {
          if (retryCount < 5) {
            const msg = `Retrying... (${retryCount + 1}/5)`;
            updateDiagnostic(adcode, 'pending', msg);
            setTimeout(() => {
              fetchDistrictBoundary(adcode, retryCount + 1).then(resolve).catch(reject);
            }, 1000);
          } else {
            const errorMsg = `Failed after 5 retries: ${status}`;
            updateDiagnostic(adcode, 'error', errorMsg);
            reject(new Error(errorMsg));
          }
        }
      });
    });
  });
};

export const getDistrictInfoByLngLat = (lnglat: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    const geocoder = new (window as any).AMap.Geocoder({
      extensions: 'all',
    });

    geocoder.getAddress(lnglat, (status: string, result: any) => {
      if (status === 'complete' && result.regeocode) {
        const addressComponent = result.regeocode.addressComponent;
        // We want county level (district)
        resolve({
          adcode: addressComponent.adcode,
          name: addressComponent.district,
          province: addressComponent.province,
          city: addressComponent.city || addressComponent.province, // For municipalities, city might be empty
        });
      } else {
        reject(new Error('Failed to get address info'));
      }
    });
  });
};
