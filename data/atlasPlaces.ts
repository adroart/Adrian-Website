/**
 * Pinned copy of the Mandala Atlas location manifest used for legacy import.
 * Keep changes explicit and reviewed. Runtime code must not import from the
 * separate Mandala workspace.
 */
export type TrustedAtlasPlace = {
  id: string;
  city: string;
  region?: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
};

export const TRUSTED_ATLAS_PLACES: readonly TrustedAtlasPlace[] = [
  {
    "id": "denpasar-id",
    "city": "Denpasar",
    "country": "Indonesia",
    "countryCode": "ID",
    "lat": -8.65,
    "lng": 115.2167
  },
  {
    "id": "ubud-id",
    "city": "Ubud",
    "country": "Indonesia",
    "countryCode": "ID",
    "lat": -8.5069,
    "lng": 115.2625
  },
  {
    "id": "jakarta-id",
    "city": "Jakarta",
    "country": "Indonesia",
    "countryCode": "ID",
    "lat": -6.2088,
    "lng": 106.8456
  },
  {
    "id": "berlin-de",
    "city": "Berlin",
    "country": "Germany",
    "countryCode": "DE",
    "lat": 52.52,
    "lng": 13.405
  },
  {
    "id": "hamburg-de",
    "city": "Hamburg",
    "country": "Germany",
    "countryCode": "DE",
    "lat": 53.5511,
    "lng": 9.9937
  },
  {
    "id": "munich-de",
    "city": "Munich",
    "country": "Germany",
    "countryCode": "DE",
    "lat": 48.1351,
    "lng": 11.582
  },
  {
    "id": "lisbon-pt",
    "city": "Lisbon",
    "country": "Portugal",
    "countryCode": "PT",
    "lat": 38.7223,
    "lng": -9.1393
  },
  {
    "id": "amsterdam-nl",
    "city": "Amsterdam",
    "country": "Netherlands",
    "countryCode": "NL",
    "lat": 52.3676,
    "lng": 4.9041
  },
  {
    "id": "rotterdam-nl",
    "city": "Rotterdam",
    "country": "Netherlands",
    "countryCode": "NL",
    "lat": 51.9244,
    "lng": 4.4777
  },
  {
    "id": "london-gb",
    "city": "London",
    "country": "United Kingdom",
    "countryCode": "GB",
    "lat": 51.5074,
    "lng": -0.1278
  },
  {
    "id": "edinburgh-gb",
    "city": "Edinburgh",
    "country": "United Kingdom",
    "countryCode": "GB",
    "lat": 55.9533,
    "lng": -3.1883
  },
  {
    "id": "dublin-ie",
    "city": "Dublin",
    "country": "Ireland",
    "countryCode": "IE",
    "lat": 53.3498,
    "lng": -6.2603
  },
  {
    "id": "paris-fr",
    "city": "Paris",
    "country": "France",
    "countryCode": "FR",
    "lat": 48.8566,
    "lng": 2.3522
  },
  {
    "id": "barcelona-es",
    "city": "Barcelona",
    "country": "Spain",
    "countryCode": "ES",
    "lat": 41.3851,
    "lng": 2.1734
  },
  {
    "id": "madrid-es",
    "city": "Madrid",
    "country": "Spain",
    "countryCode": "ES",
    "lat": 40.4168,
    "lng": -3.7038
  },
  {
    "id": "rome-it",
    "city": "Rome",
    "country": "Italy",
    "countryCode": "IT",
    "lat": 41.9028,
    "lng": 12.4964
  },
  {
    "id": "florence-it",
    "city": "Florence",
    "country": "Italy",
    "countryCode": "IT",
    "lat": 43.7696,
    "lng": 11.2558
  },
  {
    "id": "venice-it",
    "city": "Venice",
    "country": "Italy",
    "countryCode": "IT",
    "lat": 45.4408,
    "lng": 12.3155
  },
  {
    "id": "vienna-at",
    "city": "Vienna",
    "country": "Austria",
    "countryCode": "AT",
    "lat": 48.2082,
    "lng": 16.3738
  },
  {
    "id": "prague-cz",
    "city": "Prague",
    "country": "Czechia",
    "countryCode": "CZ",
    "lat": 50.0755,
    "lng": 14.4378
  },
  {
    "id": "budapest-hu",
    "city": "Budapest",
    "country": "Hungary",
    "countryCode": "HU",
    "lat": 47.4979,
    "lng": 19.0402
  },
  {
    "id": "warsaw-pl",
    "city": "Warsaw",
    "country": "Poland",
    "countryCode": "PL",
    "lat": 52.2297,
    "lng": 21.0122
  },
  {
    "id": "krakow-pl",
    "city": "Krakow",
    "country": "Poland",
    "countryCode": "PL",
    "lat": 50.0647,
    "lng": 19.945
  },
  {
    "id": "copenhagen-dk",
    "city": "Copenhagen",
    "country": "Denmark",
    "countryCode": "DK",
    "lat": 55.6761,
    "lng": 12.5683
  },
  {
    "id": "stockholm-se",
    "city": "Stockholm",
    "country": "Sweden",
    "countryCode": "SE",
    "lat": 59.3293,
    "lng": 18.0686
  },
  {
    "id": "oslo-no",
    "city": "Oslo",
    "country": "Norway",
    "countryCode": "NO",
    "lat": 59.9139,
    "lng": 10.7522
  },
  {
    "id": "helsinki-fi",
    "city": "Helsinki",
    "country": "Finland",
    "countryCode": "FI",
    "lat": 60.1699,
    "lng": 24.9384
  },
  {
    "id": "reykjavik-is",
    "city": "Reykjavik",
    "country": "Iceland",
    "countryCode": "IS",
    "lat": 64.1466,
    "lng": -21.9426
  },
  {
    "id": "brussels-be",
    "city": "Brussels",
    "country": "Belgium",
    "countryCode": "BE",
    "lat": 50.8503,
    "lng": 4.3517
  },
  {
    "id": "antwerp-be",
    "city": "Antwerp",
    "country": "Belgium",
    "countryCode": "BE",
    "lat": 51.2194,
    "lng": 4.4025
  },
  {
    "id": "zurich-ch",
    "city": "Zurich",
    "country": "Switzerland",
    "countryCode": "CH",
    "lat": 47.3769,
    "lng": 8.5417
  },
  {
    "id": "geneva-ch",
    "city": "Geneva",
    "country": "Switzerland",
    "countryCode": "CH",
    "lat": 46.2044,
    "lng": 6.1432
  },
  {
    "id": "tallinn-ee",
    "city": "Tallinn",
    "country": "Estonia",
    "countryCode": "EE",
    "lat": 59.437,
    "lng": 24.7536
  },
  {
    "id": "riga-lv",
    "city": "Riga",
    "country": "Latvia",
    "countryCode": "LV",
    "lat": 56.9496,
    "lng": 24.1052
  },
  {
    "id": "vilnius-lt",
    "city": "Vilnius",
    "country": "Lithuania",
    "countryCode": "LT",
    "lat": 54.6872,
    "lng": 25.2797
  },
  {
    "id": "athens-gr",
    "city": "Athens",
    "country": "Greece",
    "countryCode": "GR",
    "lat": 37.9838,
    "lng": 23.7275
  },
  {
    "id": "istanbul-tr",
    "city": "Istanbul",
    "country": "Turkey",
    "countryCode": "TR",
    "lat": 41.0082,
    "lng": 28.9784
  },
  {
    "id": "tel-aviv-il",
    "city": "Tel Aviv",
    "country": "Israel",
    "countryCode": "IL",
    "lat": 32.0853,
    "lng": 34.7818
  },
  {
    "id": "marrakech-ma",
    "city": "Marrakech",
    "country": "Morocco",
    "countryCode": "MA",
    "lat": 31.6295,
    "lng": -7.9811
  },
  {
    "id": "cairo-eg",
    "city": "Cairo",
    "country": "Egypt",
    "countryCode": "EG",
    "lat": 30.0444,
    "lng": 31.2357
  },
  {
    "id": "cape-town-za",
    "city": "Cape Town",
    "country": "South Africa",
    "countryCode": "ZA",
    "lat": -33.9249,
    "lng": 18.4241
  },
  {
    "id": "nairobi-ke",
    "city": "Nairobi",
    "country": "Kenya",
    "countryCode": "KE",
    "lat": -1.2921,
    "lng": 36.8219
  },
  {
    "id": "lagos-ng",
    "city": "Lagos",
    "country": "Nigeria",
    "countryCode": "NG",
    "lat": 6.5244,
    "lng": 3.3792
  },
  {
    "id": "new-york-us",
    "city": "New York",
    "region": "New York",
    "country": "United States",
    "countryCode": "US",
    "lat": 40.7128,
    "lng": -74.006
  },
  {
    "id": "los-angeles-us",
    "city": "Los Angeles",
    "region": "California",
    "country": "United States",
    "countryCode": "US",
    "lat": 34.0522,
    "lng": -118.2437
  },
  {
    "id": "san-francisco-us",
    "city": "San Francisco",
    "region": "California",
    "country": "United States",
    "countryCode": "US",
    "lat": 37.7749,
    "lng": -122.4194
  },
  {
    "id": "seattle-us",
    "city": "Seattle",
    "region": "Washington",
    "country": "United States",
    "countryCode": "US",
    "lat": 47.6062,
    "lng": -122.3321
  },
  {
    "id": "portland-us",
    "city": "Portland",
    "region": "Oregon",
    "country": "United States",
    "countryCode": "US",
    "lat": 45.5152,
    "lng": -122.6784
  },
  {
    "id": "austin-us",
    "city": "Austin",
    "region": "Texas",
    "country": "United States",
    "countryCode": "US",
    "lat": 30.2672,
    "lng": -97.7431
  },
  {
    "id": "miami-us",
    "city": "Miami",
    "region": "Florida",
    "country": "United States",
    "countryCode": "US",
    "lat": 25.7617,
    "lng": -80.1918
  },
  {
    "id": "chicago-us",
    "city": "Chicago",
    "region": "Illinois",
    "country": "United States",
    "countryCode": "US",
    "lat": 41.8781,
    "lng": -87.6298
  },
  {
    "id": "boston-us",
    "city": "Boston",
    "region": "Massachusetts",
    "country": "United States",
    "countryCode": "US",
    "lat": 42.3601,
    "lng": -71.0589
  },
  {
    "id": "washington-dc-us",
    "city": "Washington",
    "region": "District of Columbia",
    "country": "United States",
    "countryCode": "US",
    "lat": 38.9072,
    "lng": -77.0369
  },
  {
    "id": "denver-us",
    "city": "Denver",
    "region": "Colorado",
    "country": "United States",
    "countryCode": "US",
    "lat": 39.7392,
    "lng": -104.9903
  },
  {
    "id": "honolulu-us",
    "city": "Honolulu",
    "region": "Hawaii",
    "country": "United States",
    "countryCode": "US",
    "lat": 21.3069,
    "lng": -157.8583
  },
  {
    "id": "vancouver-ca",
    "city": "Vancouver",
    "region": "British Columbia",
    "country": "Canada",
    "countryCode": "CA",
    "lat": 49.2827,
    "lng": -123.1207
  },
  {
    "id": "toronto-ca",
    "city": "Toronto",
    "region": "Ontario",
    "country": "Canada",
    "countryCode": "CA",
    "lat": 43.6532,
    "lng": -79.3832
  },
  {
    "id": "montreal-ca",
    "city": "Montreal",
    "region": "Quebec",
    "country": "Canada",
    "countryCode": "CA",
    "lat": 45.5017,
    "lng": -73.5673
  },
  {
    "id": "mexico-city-mx",
    "city": "Mexico City",
    "country": "Mexico",
    "countryCode": "MX",
    "lat": 19.4326,
    "lng": -99.1332
  },
  {
    "id": "tulum-mx",
    "city": "Tulum",
    "country": "Mexico",
    "countryCode": "MX",
    "lat": 20.2114,
    "lng": -87.4654
  },
  {
    "id": "oaxaca-mx",
    "city": "Oaxaca",
    "country": "Mexico",
    "countryCode": "MX",
    "lat": 17.0732,
    "lng": -96.7266
  },
  {
    "id": "sayulita-mx",
    "city": "Sayulita",
    "country": "Mexico",
    "countryCode": "MX",
    "lat": 20.87,
    "lng": -105.4419
  },
  {
    "id": "san-jose-cr",
    "city": "San Jose",
    "country": "Costa Rica",
    "countryCode": "CR",
    "lat": 9.9281,
    "lng": -84.0907
  },
  {
    "id": "panama-city-pa",
    "city": "Panama City",
    "country": "Panama",
    "countryCode": "PA",
    "lat": 8.9824,
    "lng": -79.5199
  },
  {
    "id": "havana-cu",
    "city": "Havana",
    "country": "Cuba",
    "countryCode": "CU",
    "lat": 23.1136,
    "lng": -82.3666
  },
  {
    "id": "sao-paulo-br",
    "city": "Sao Paulo",
    "country": "Brazil",
    "countryCode": "BR",
    "lat": -23.5505,
    "lng": -46.6333
  },
  {
    "id": "rio-de-janeiro-br",
    "city": "Rio de Janeiro",
    "country": "Brazil",
    "countryCode": "BR",
    "lat": -22.9068,
    "lng": -43.1729
  },
  {
    "id": "buenos-aires-ar",
    "city": "Buenos Aires",
    "country": "Argentina",
    "countryCode": "AR",
    "lat": -34.6037,
    "lng": -58.3816
  },
  {
    "id": "bogota-co",
    "city": "Bogota",
    "country": "Colombia",
    "countryCode": "CO",
    "lat": 4.711,
    "lng": -74.0721
  },
  {
    "id": "lima-pe",
    "city": "Lima",
    "country": "Peru",
    "countryCode": "PE",
    "lat": -12.0464,
    "lng": -77.0428
  },
  {
    "id": "quito-ec",
    "city": "Quito",
    "country": "Ecuador",
    "countryCode": "EC",
    "lat": -0.1807,
    "lng": -78.4678
  },
  {
    "id": "santiago-cl",
    "city": "Santiago",
    "country": "Chile",
    "countryCode": "CL",
    "lat": -33.4489,
    "lng": -70.6693
  },
  {
    "id": "tokyo-jp",
    "city": "Tokyo",
    "country": "Japan",
    "countryCode": "JP",
    "lat": 35.6762,
    "lng": 139.6503
  },
  {
    "id": "kyoto-jp",
    "city": "Kyoto",
    "country": "Japan",
    "countryCode": "JP",
    "lat": 35.0116,
    "lng": 135.7681
  },
  {
    "id": "seoul-kr",
    "city": "Seoul",
    "country": "South Korea",
    "countryCode": "KR",
    "lat": 37.5665,
    "lng": 126.978
  },
  {
    "id": "shanghai-cn",
    "city": "Shanghai",
    "country": "China",
    "countryCode": "CN",
    "lat": 31.2304,
    "lng": 121.4737
  },
  {
    "id": "beijing-cn",
    "city": "Beijing",
    "country": "China",
    "countryCode": "CN",
    "lat": 39.9042,
    "lng": 116.4074
  },
  {
    "id": "hong-kong-hk",
    "city": "Hong Kong",
    "country": "Hong Kong",
    "countryCode": "HK",
    "lat": 22.3193,
    "lng": 114.1694
  },
  {
    "id": "taipei-tw",
    "city": "Taipei",
    "country": "Taiwan",
    "countryCode": "TW",
    "lat": 25.033,
    "lng": 121.5654
  },
  {
    "id": "bangkok-th",
    "city": "Bangkok",
    "country": "Thailand",
    "countryCode": "TH",
    "lat": 13.7563,
    "lng": 100.5018
  },
  {
    "id": "chiang-mai-th",
    "city": "Chiang Mai",
    "country": "Thailand",
    "countryCode": "TH",
    "lat": 18.7883,
    "lng": 98.9853
  },
  {
    "id": "singapore-sg",
    "city": "Singapore",
    "country": "Singapore",
    "countryCode": "SG",
    "lat": 1.3521,
    "lng": 103.8198
  },
  {
    "id": "kuala-lumpur-my",
    "city": "Kuala Lumpur",
    "country": "Malaysia",
    "countryCode": "MY",
    "lat": 3.139,
    "lng": 101.6869
  },
  {
    "id": "manila-ph",
    "city": "Manila",
    "country": "Philippines",
    "countryCode": "PH",
    "lat": 14.5995,
    "lng": 120.9842
  },
  {
    "id": "hanoi-vn",
    "city": "Hanoi",
    "country": "Vietnam",
    "countryCode": "VN",
    "lat": 21.0285,
    "lng": 105.8542
  },
  {
    "id": "ho-chi-minh-city-vn",
    "city": "Ho Chi Minh City",
    "country": "Vietnam",
    "countryCode": "VN",
    "lat": 10.8231,
    "lng": 106.6297
  },
  {
    "id": "phnom-penh-kh",
    "city": "Phnom Penh",
    "country": "Cambodia",
    "countryCode": "KH",
    "lat": 11.5564,
    "lng": 104.9282
  },
  {
    "id": "vientiane-la",
    "city": "Vientiane",
    "country": "Laos",
    "countryCode": "LA",
    "lat": 17.9757,
    "lng": 102.6331
  },
  {
    "id": "yangon-mm",
    "city": "Yangon",
    "country": "Myanmar",
    "countryCode": "MM",
    "lat": 16.8409,
    "lng": 96.1735
  },
  {
    "id": "mumbai-in",
    "city": "Mumbai",
    "region": "Maharashtra",
    "country": "India",
    "countryCode": "IN",
    "lat": 19.076,
    "lng": 72.8777
  },
  {
    "id": "delhi-in",
    "city": "Delhi",
    "country": "India",
    "countryCode": "IN",
    "lat": 28.7041,
    "lng": 77.1025
  },
  {
    "id": "bangalore-in",
    "city": "Bangalore",
    "region": "Karnataka",
    "country": "India",
    "countryCode": "IN",
    "lat": 12.9716,
    "lng": 77.5946
  },
  {
    "id": "goa-in",
    "city": "Goa",
    "region": "Goa",
    "country": "India",
    "countryCode": "IN",
    "lat": 15.2993,
    "lng": 74.124
  },
  {
    "id": "kathmandu-np",
    "city": "Kathmandu",
    "country": "Nepal",
    "countryCode": "NP",
    "lat": 27.7172,
    "lng": 85.324
  },
  {
    "id": "sydney-au",
    "city": "Sydney",
    "region": "New South Wales",
    "country": "Australia",
    "countryCode": "AU",
    "lat": -33.8688,
    "lng": 151.2093
  },
  {
    "id": "melbourne-au",
    "city": "Melbourne",
    "region": "Victoria",
    "country": "Australia",
    "countryCode": "AU",
    "lat": -37.8136,
    "lng": 144.9631
  },
  {
    "id": "auckland-nz",
    "city": "Auckland",
    "country": "New Zealand",
    "countryCode": "NZ",
    "lat": -36.8485,
    "lng": 174.7633
  },
  {
    "id": "wellington-nz",
    "city": "Wellington",
    "country": "New Zealand",
    "countryCode": "NZ",
    "lat": -41.2865,
    "lng": 174.7762
  },
  {
    "id": "country-id",
    "city": "Indonesia",
    "country": "Indonesia",
    "countryCode": "ID",
    "lat": -2.55,
    "lng": 118.01
  },
  {
    "id": "country-de",
    "city": "Germany",
    "country": "Germany",
    "countryCode": "DE",
    "lat": 51.17,
    "lng": 10.45
  },
  {
    "id": "country-pt",
    "city": "Portugal",
    "country": "Portugal",
    "countryCode": "PT",
    "lat": 39.56,
    "lng": -7.84
  },
  {
    "id": "country-nl",
    "city": "Netherlands",
    "country": "Netherlands",
    "countryCode": "NL",
    "lat": 52.13,
    "lng": 5.29
  },
  {
    "id": "country-gb",
    "city": "United Kingdom",
    "country": "United Kingdom",
    "countryCode": "GB",
    "lat": 55.38,
    "lng": -3.44
  },
  {
    "id": "country-ie",
    "city": "Ireland",
    "country": "Ireland",
    "countryCode": "IE",
    "lat": 53.41,
    "lng": -8.24
  },
  {
    "id": "country-fr",
    "city": "France",
    "country": "France",
    "countryCode": "FR",
    "lat": 46.23,
    "lng": 2.21
  },
  {
    "id": "country-es",
    "city": "Spain",
    "country": "Spain",
    "countryCode": "ES",
    "lat": 40.46,
    "lng": -3.75
  },
  {
    "id": "country-it",
    "city": "Italy",
    "country": "Italy",
    "countryCode": "IT",
    "lat": 41.87,
    "lng": 12.57
  },
  {
    "id": "country-at",
    "city": "Austria",
    "country": "Austria",
    "countryCode": "AT",
    "lat": 47.52,
    "lng": 14.55
  },
  {
    "id": "country-cz",
    "city": "Czechia",
    "country": "Czechia",
    "countryCode": "CZ",
    "lat": 49.82,
    "lng": 15.47
  },
  {
    "id": "country-hu",
    "city": "Hungary",
    "country": "Hungary",
    "countryCode": "HU",
    "lat": 47.16,
    "lng": 19.5
  },
  {
    "id": "country-pl",
    "city": "Poland",
    "country": "Poland",
    "countryCode": "PL",
    "lat": 51.92,
    "lng": 19.15
  },
  {
    "id": "country-dk",
    "city": "Denmark",
    "country": "Denmark",
    "countryCode": "DK",
    "lat": 56.26,
    "lng": 9.5
  },
  {
    "id": "country-se",
    "city": "Sweden",
    "country": "Sweden",
    "countryCode": "SE",
    "lat": 60.13,
    "lng": 18.64
  },
  {
    "id": "country-no",
    "city": "Norway",
    "country": "Norway",
    "countryCode": "NO",
    "lat": 60.47,
    "lng": 8.47
  },
  {
    "id": "country-fi",
    "city": "Finland",
    "country": "Finland",
    "countryCode": "FI",
    "lat": 61.92,
    "lng": 25.75
  },
  {
    "id": "country-is",
    "city": "Iceland",
    "country": "Iceland",
    "countryCode": "IS",
    "lat": 64.96,
    "lng": -19.02
  },
  {
    "id": "country-be",
    "city": "Belgium",
    "country": "Belgium",
    "countryCode": "BE",
    "lat": 50.5,
    "lng": 4.47
  },
  {
    "id": "country-ch",
    "city": "Switzerland",
    "country": "Switzerland",
    "countryCode": "CH",
    "lat": 46.82,
    "lng": 8.23
  },
  {
    "id": "country-ee",
    "city": "Estonia",
    "country": "Estonia",
    "countryCode": "EE",
    "lat": 58.6,
    "lng": 25.01
  },
  {
    "id": "country-lv",
    "city": "Latvia",
    "country": "Latvia",
    "countryCode": "LV",
    "lat": 56.88,
    "lng": 24.6
  },
  {
    "id": "country-lt",
    "city": "Lithuania",
    "country": "Lithuania",
    "countryCode": "LT",
    "lat": 55.17,
    "lng": 23.88
  },
  {
    "id": "country-gr",
    "city": "Greece",
    "country": "Greece",
    "countryCode": "GR",
    "lat": 39.07,
    "lng": 21.82
  },
  {
    "id": "country-tr",
    "city": "Turkey",
    "country": "Turkey",
    "countryCode": "TR",
    "lat": 38.96,
    "lng": 35.24
  },
  {
    "id": "country-il",
    "city": "Israel",
    "country": "Israel",
    "countryCode": "IL",
    "lat": 31.05,
    "lng": 34.85
  },
  {
    "id": "country-ma",
    "city": "Morocco",
    "country": "Morocco",
    "countryCode": "MA",
    "lat": 31.79,
    "lng": -7.09
  },
  {
    "id": "country-eg",
    "city": "Egypt",
    "country": "Egypt",
    "countryCode": "EG",
    "lat": 26.82,
    "lng": 30.8
  },
  {
    "id": "country-za",
    "city": "South Africa",
    "country": "South Africa",
    "countryCode": "ZA",
    "lat": -30.56,
    "lng": 22.94
  },
  {
    "id": "country-ke",
    "city": "Kenya",
    "country": "Kenya",
    "countryCode": "KE",
    "lat": -0.02,
    "lng": 37.91
  },
  {
    "id": "country-ng",
    "city": "Nigeria",
    "country": "Nigeria",
    "countryCode": "NG",
    "lat": 9.08,
    "lng": 8.68
  },
  {
    "id": "country-us",
    "city": "United States",
    "country": "United States",
    "countryCode": "US",
    "lat": 37.09,
    "lng": -95.71
  },
  {
    "id": "country-ca",
    "city": "Canada",
    "country": "Canada",
    "countryCode": "CA",
    "lat": 56.13,
    "lng": -106.35
  },
  {
    "id": "country-mx",
    "city": "Mexico",
    "country": "Mexico",
    "countryCode": "MX",
    "lat": 23.63,
    "lng": -102.55
  },
  {
    "id": "country-cr",
    "city": "Costa Rica",
    "country": "Costa Rica",
    "countryCode": "CR",
    "lat": 9.75,
    "lng": -83.75
  },
  {
    "id": "country-pa",
    "city": "Panama",
    "country": "Panama",
    "countryCode": "PA",
    "lat": 8.54,
    "lng": -80.78
  },
  {
    "id": "country-cu",
    "city": "Cuba",
    "country": "Cuba",
    "countryCode": "CU",
    "lat": 21.52,
    "lng": -77.78
  },
  {
    "id": "country-br",
    "city": "Brazil",
    "country": "Brazil",
    "countryCode": "BR",
    "lat": -14.24,
    "lng": -51.93
  },
  {
    "id": "country-ar",
    "city": "Argentina",
    "country": "Argentina",
    "countryCode": "AR",
    "lat": -38.42,
    "lng": -63.62
  },
  {
    "id": "country-co",
    "city": "Colombia",
    "country": "Colombia",
    "countryCode": "CO",
    "lat": 4.57,
    "lng": -74.3
  },
  {
    "id": "country-pe",
    "city": "Peru",
    "country": "Peru",
    "countryCode": "PE",
    "lat": -9.19,
    "lng": -75.02
  },
  {
    "id": "country-ec",
    "city": "Ecuador",
    "country": "Ecuador",
    "countryCode": "EC",
    "lat": -1.83,
    "lng": -78.18
  },
  {
    "id": "country-cl",
    "city": "Chile",
    "country": "Chile",
    "countryCode": "CL",
    "lat": -35.68,
    "lng": -71.54
  },
  {
    "id": "country-jp",
    "city": "Japan",
    "country": "Japan",
    "countryCode": "JP",
    "lat": 36.2,
    "lng": 138.25
  },
  {
    "id": "country-kr",
    "city": "South Korea",
    "country": "South Korea",
    "countryCode": "KR",
    "lat": 35.91,
    "lng": 127.77
  },
  {
    "id": "country-cn",
    "city": "China",
    "country": "China",
    "countryCode": "CN",
    "lat": 35.86,
    "lng": 104.2
  },
  {
    "id": "country-tw",
    "city": "Taiwan",
    "country": "Taiwan",
    "countryCode": "TW",
    "lat": 23.7,
    "lng": 120.96
  },
  {
    "id": "country-th",
    "city": "Thailand",
    "country": "Thailand",
    "countryCode": "TH",
    "lat": 15.87,
    "lng": 100.99
  },
  {
    "id": "country-my",
    "city": "Malaysia",
    "country": "Malaysia",
    "countryCode": "MY",
    "lat": 4.21,
    "lng": 101.98
  },
  {
    "id": "country-ph",
    "city": "Philippines",
    "country": "Philippines",
    "countryCode": "PH",
    "lat": 12.88,
    "lng": 121.77
  },
  {
    "id": "country-vn",
    "city": "Vietnam",
    "country": "Vietnam",
    "countryCode": "VN",
    "lat": 14.06,
    "lng": 108.28
  },
  {
    "id": "country-kh",
    "city": "Cambodia",
    "country": "Cambodia",
    "countryCode": "KH",
    "lat": 12.57,
    "lng": 104.99
  },
  {
    "id": "country-la",
    "city": "Laos",
    "country": "Laos",
    "countryCode": "LA",
    "lat": 19.86,
    "lng": 102.5
  },
  {
    "id": "country-mm",
    "city": "Myanmar",
    "country": "Myanmar",
    "countryCode": "MM",
    "lat": 21.91,
    "lng": 95.96
  },
  {
    "id": "country-in",
    "city": "India",
    "country": "India",
    "countryCode": "IN",
    "lat": 20.59,
    "lng": 78.96
  },
  {
    "id": "country-np",
    "city": "Nepal",
    "country": "Nepal",
    "countryCode": "NP",
    "lat": 28.39,
    "lng": 84.12
  },
  {
    "id": "country-au",
    "city": "Australia",
    "country": "Australia",
    "countryCode": "AU",
    "lat": -25.27,
    "lng": 133.78
  },
  {
    "id": "country-nz",
    "city": "New Zealand",
    "country": "New Zealand",
    "countryCode": "NZ",
    "lat": -40.9,
    "lng": 174.89
  }
] as const;
