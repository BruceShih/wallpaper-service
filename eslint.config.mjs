import antfu from '@antfu/eslint-config'

export default antfu({}, {}, {
  rules: {
    'style/comma-dangle': ['error', 'never']
  }
})
